/**
 * Invariant: no execution logic leaks into policy-core.
 *
 * Asymmetric counterpart to trust-gate's policy-leak.test.ts.
 *
 *   trust-gate invariant: gate must not become policy
 *   policy-core invariant: policy must not become gate
 *
 * Policy-core describes truth conditions.
 * Trust-gate enforces truth boundaries.
 *
 * What this file guards:
 *   CHECK A — No I/O imports (fs, http, net, child_process, worker_threads)
 *   CHECK B — No runtime layer imports (trust-gate, builder, agent, cluster)
 *   CHECK C — No side-effect calls (writeFile, fetch, execSync, process.exit, spawn)
 *   CHECK D — No thresholds / heuristics in non-policy files (types.ts, index.ts)
 *
 * How to suppress a false positive:
 *   Add a line-level comment:  // execution-leak-ignore: <reason>
 *   The reason stays in the code and remains reviewable.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ---------------------------------------------------------------------------
// File scanner
// ---------------------------------------------------------------------------

const POLICY_SRC = join(__dirname, "..");  // dist/src/rpp/../ = dist/src/ at runtime
// But we need to scan TypeScript source, not compiled JS.
// Resolve from dist/src/ back to src/ by replacing the path segment.
const POLICY_SRC_TS = POLICY_SRC.replace(/[\\/]dist[\\/]src$/, "/src")
  .replace(/[\\/]dist[\\/]src[\\/]/, "/src/");

function allTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...allTsFiles(full));
    } else if (
      entry.endsWith(".ts") &&
      !entry.endsWith(".d.ts") &&
      !entry.endsWith(".test.ts")  // skip test files
    ) {
      results.push(full);
    }
  }
  return results;
}

interface Violation {
  file: string;
  line: number;
  col: number;
  check: string;
  text: string;
}

function scan(
  files: string[],
  pattern: RegExp,
  checkName: string,
  ignoreTag: string
): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(ignoreTag)) continue;
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        violations.push({
          file: relative(POLICY_SRC_TS, file),
          line: i + 1,
          col: match.index + 1,
          check: checkName,
          text: line.trim(),
        });
      }
    }
  }
  return violations;
}

function formatViolations(vs: Violation[]): string {
  return vs
    .map((v) => `  ${v.file}:${v.line}:${v.col}  [${v.check}]\n    ${v.text}`)
    .join("\n");
}

const allFiles = allTsFiles(POLICY_SRC_TS);

// Policy files: allowed to contain thresholds and decision logic.
// Anything under policies/, evaluate-*.ts, coherence-check.ts, reasoning-gate.ts, rpp/
const POLICY_FILES = new Set(
  allFiles.filter((f) => {
    const rel = relative(POLICY_SRC_TS, f);
    return (
      rel.startsWith("policies/") ||
      rel.startsWith("rpp/") ||
      rel === "evaluate-v4.ts" ||
      rel === "evaluate-v5.ts" ||
      rel === "coherence-check.ts" ||
      rel === "reasoning-gate.ts" ||
      rel === "policies.ts"
    );
  })
);

// Non-policy files: types, index, barrel exports — must not contain logic.
const NON_POLICY_FILES = allFiles.filter((f) => !POLICY_FILES.has(f));


// ---------------------------------------------------------------------------
// CHECK A — No I/O imports
//
// Policy evaluation is pure: same input → same output.
// Importing fs/http/net would allow side effects that break this contract.
// ---------------------------------------------------------------------------
test("CHECK A: no I/O module imports in src/", () => {
  const IO_IMPORT = /from\s+["'](node:fs|node:http|node:https|node:net|node:child_process|node:worker_threads|node:stream|fs|http|https|child_process)["']/g;

  const vs = scan(allFiles, IO_IMPORT, "IO_IMPORT", "execution-leak-ignore");

  assert.equal(
    vs.length,
    0,
    `Execution leakage — I/O imports found in policy-core/src/:\n${formatViolations(vs)}\n\n` +
      `Policy evaluation must be pure (same input → same output, no side effects).\n` +
      `I/O belongs in the runtime/execution layer, not in policy definitions.\n` +
      `To suppress a false positive add:  // execution-leak-ignore: <reason>`
  );
});

// ---------------------------------------------------------------------------
// CHECK B — No runtime layer imports
//
// Policy-core must not know about the gate, builder, agent, or cluster layers.
// Importing them creates an inverted dependency that collapses the separation.
//
// Correct direction: trust-gate → policy-core (gate calls policy)
// Wrong direction:   policy-core → trust-gate (policy calls gate)
// ---------------------------------------------------------------------------
test("CHECK B: no runtime layer imports in src/", () => {
  const RUNTIME_IMPORT = /from\s+["'](@jingu\/trust-gate|@jingu\/builder|@jingu\/agent|@jingu\/cluster|jingu-trust-gate|jingu-builder|jingu-agent|jingu-cluster)/g;

  const vs = scan(allFiles, RUNTIME_IMPORT, "RUNTIME_IMPORT", "execution-leak-ignore");

  assert.equal(
    vs.length,
    0,
    `Execution leakage — runtime layer imports found in policy-core/src/:\n${formatViolations(vs)}\n\n` +
      `Dependency must flow: trust-gate → policy-core, never the reverse.\n` +
      `If policy-core needs a type from the gate layer, move that type to a shared contract package.\n` +
      `To suppress a false positive add:  // execution-leak-ignore: <reason>`
  );
});

// ---------------------------------------------------------------------------
// CHECK C — No side-effect calls
//
// Policy functions must not write files, send requests, spawn processes,
// or exit the runtime. They describe truth conditions; they do not act.
//
// "policy 只该回答：这东西是否满足规则？为什么？"
// "不该回答：现在立刻 block 还是 retry 还是 escalate？"
// ---------------------------------------------------------------------------
test("CHECK C: no side-effect calls in src/", () => {
  const SIDE_EFFECT = /\b(writeFile|readFile|appendFile|writeFileSync|readFileSync|fetch\s*\(|axios\.|got\(|execSync|spawnSync|exec\s*\(|spawn\s*\(|process\.exit|process\.kill|setTimeout|setInterval)\b/g;

  const vs = scan(allFiles, SIDE_EFFECT, "SIDE_EFFECT_CALL", "execution-leak-ignore");

  assert.equal(
    vs.length,
    0,
    `Execution leakage — side-effect calls found in policy-core/src/:\n${formatViolations(vs)}\n\n` +
      `Policy functions must be pure: no file I/O, no network, no process control.\n` +
      `Move side-effecting logic to the caller (trust-gate, builder, or agent layer).\n` +
      `To suppress a false positive add:  // execution-leak-ignore: <reason>`
  );
});

// ---------------------------------------------------------------------------
// CHECK D — No thresholds / heuristics in non-policy files
//
// Rule parameters (thresholds, magic numbers) must live in policy modules,
// not in type definitions, index barrels, or utility files.
// A threshold in types.ts or index.ts is a hidden policy that bypasses review.
//
// Allowed files: policies/, evaluate-*.ts, coherence-check.ts, reasoning-gate.ts, rpp/
// Checked files: types.ts, index.ts, and anything outside the policy set
// ---------------------------------------------------------------------------
test("CHECK D: no thresholds in non-policy files (types.ts, index.ts, etc.)", () => {
  // Numeric thresholds: floats, or integers >= 2 (0 and 1 are cardinality, not thresholds)
  const THRESHOLD = /[><]=?\s*(0\.\d+|\b[2-9]\d*\b)/g;

  const vs = scan(NON_POLICY_FILES, THRESHOLD, "HIDDEN_THRESHOLD", "execution-leak-ignore");

  assert.equal(
    vs.length,
    0,
    `Execution leakage — thresholds found in non-policy files:\n${formatViolations(vs)}\n\n` +
      `Rule parameters must be explicit and live in policy modules.\n` +
      `A threshold in types.ts or index.ts is a hidden policy that escapes review.\n` +
      `Move it to the appropriate policy file (policies/, evaluate-*.ts, coherence-check.ts, rpp/).\n` +
      `To suppress a false positive add:  // execution-leak-ignore: <reason>`
  );
});
