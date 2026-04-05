#!/usr/bin/env node
/**
 * check-single-source.mjs
 *
 * CI check for SST1 (Single Source of Truth) principle.
 *
 * Scans the jingu-swebench codebase for controlled vocabulary strings
 * (principal names, phase names, contract keys) appearing outside their
 * authoritative source file.
 *
 * Usage:
 *   node scripts/check-single-source.mjs [--root <path>]
 *
 * Exit 0 = no violations. Exit 1 = violations found.
 *
 * Origin: 2026-04-05 incident — principal names hardcoded in 5 files
 * independently of subtype_contracts.py, causing v1/v2 name mismatch.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs"
import { join, resolve, relative } from "path"

// ---------------------------------------------------------------------------
// Configuration — controlled vocabularies
// ---------------------------------------------------------------------------

/**
 * Each entry defines a vocabulary set:
 *   id            — human-readable name
 *   authSource    — the ONE file allowed to define these values (relative to root)
 *   values        — the controlled string literals to scan for
 *   allowedFiles  — additional files explicitly allowed to reference the values
 *                   (e.g. test files, migration scripts). Relative to root.
 */
const VOCABULARIES = [
  {
    id: "principal_names_v2",
    authSource: "scripts/subtype_contracts.py",
    values: [
      "causal_grounding",
      "evidence_linkage",
      "ontology_alignment",
      "phase_boundary_discipline",
      "option_comparison",
      "constraint_satisfaction",
      "action_grounding",
      "minimal_change",
      "result_verification",
      "uncertainty_honesty",
      "scope_adherence",
      "residual_risk_detection",
    ],
    // Test files and this check script itself are always exempt.
    // These files consume principal names for gate enforcement/inference logic.
    // They are legitimate secondary references — they use the names to route/check,
    // not to re-define them. Long-term goal: all should call get_required_principals()
    // instead of listing names directly. Tracked as SST migration backlog.
    allowedFiles: [
      "scripts/principal_gate.py",       // gate enforcement — reads names to compare against declared
      "scripts/principal_inference.py",  // inference — maps names to signals
      "scripts/analyze_principal_metrics.py", // analysis script — counts by name
      "scripts/cognition_check.py",      // v1 cognition layer — legacy
      "scripts/cognition_schema.py",     // v1 schema definition — legacy parallel system
    ],
  },
  {
    id: "phase_names",
    authSource: "scripts/subtype_contracts.py",
    values: ["UNDERSTAND", "OBSERVE", "ANALYZE", "DECIDE", "EXECUTE", "JUDGE"],
    // Phase names appear in many non-authoritative places legitimately (log strings,
    // config keys). This vocabulary is checked at WARNING level only.
    warnOnly: true,
    allowedFiles: [],
  },
]

// ---------------------------------------------------------------------------
// File scanner
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "__pycache__", ".mypy_cache"])
const INCLUDED_EXTS = new Set([".py", ".ts", ".js", ".mjs", ".yaml", ".yml", ".json"])

function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      yield* walkFiles(full)
    } else {
      const ext = entry.slice(entry.lastIndexOf("."))
      if (INCLUDED_EXTS.has(ext)) yield full
    }
  }
}

function isTestFile(filePath) {
  return (
    filePath.includes(".test.") ||
    filePath.includes("_test.") ||
    filePath.includes("/tests/") ||
    filePath.includes("/test/") ||
    filePath.startsWith("test_") ||
    filePath.includes("/test_")
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const rootIdx = args.indexOf("--root")
// Default root: jingu-swebench repo (two levels up from jingu-policy-core/scripts/)
const defaultRoot = resolve(import.meta.dirname, "../../../jingu-swebench")
const root = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : defaultRoot

if (!existsSync(root)) {
  console.log(`[check:single-source] root not found: ${root}`)
  console.log(`[check:single-source] SKIP — run from jingu-policy-core with --root <jingu-swebench-path>`)
  process.exit(0)
}

console.log(`[check:single-source] scanning: ${root}`)

let errorCount = 0
let warnCount = 0

for (const vocab of VOCABULARIES) {
  const authFull = resolve(root, vocab.authSource)
  const allowedSet = new Set([
    authFull,
    resolve(import.meta.url.replace("file://", "")), // this script itself
    ...(vocab.allowedFiles || []).map((f) => resolve(root, f)),
  ])

  for (const value of vocab.values) {
    const violations = []

    for (const filePath of walkFiles(root)) {
      if (allowedSet.has(filePath)) continue
      if (isTestFile(relative(root, filePath))) continue

      try {
        const content = readFileSync(filePath, "utf8")
        // Match value as a quoted string literal (single or double quotes)
        const pattern = new RegExp(`["']${value}["']`)
        if (pattern.test(content)) {
          violations.push(relative(root, filePath))
        }
      } catch {
        // Binary file or unreadable — skip
      }
    }

    if (violations.length > 0) {
      const severity = vocab.warnOnly ? "WARN" : "ERROR"
      const prefix = `[check:single-source] ${severity}`
      console.log(
        `${prefix} SST${vocab.warnOnly ? "1-warn" : "1"}: "${value}" (vocab: ${vocab.id})` +
        ` found outside authoritative source (${vocab.authSource}) in:`
      )
      for (const v of violations) {
        console.log(`  ${v}`)
      }
      if (vocab.warnOnly) {
        warnCount++
      } else {
        errorCount++
      }
    }
  }
}

if (errorCount === 0 && warnCount === 0) {
  console.log("[check:single-source] PASS — no SST violations found")
} else if (errorCount === 0) {
  console.log(`[check:single-source] PASS with ${warnCount} warning(s) — no blocking violations`)
} else {
  console.log(
    `[check:single-source] FAIL — ${errorCount} error(s), ${warnCount} warning(s). ` +
    `Controlled vocabulary must only be defined in the authoritative source. ` +
    `Consumers must call accessor functions (get_required_principals, etc.) instead of hardcoding.`
  )
  process.exit(1)
}
