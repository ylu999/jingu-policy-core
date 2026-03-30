# Closure Drift Principles

**Canonical definition.** Source of truth for Closure Drift Detection.
Consumer-facing behavioral guide: `~/.claude/rules/closure-drift.md`
CI enforcement: `scripts/check-closure-drift.mjs` in jingu-agent

---

## Problem Statement

System Closure (L5) is a snapshot, not a permanent state.

```
current code = L5
≠
future changes → still L5
```

A system that is closed today can silently degrade as code evolves.
The goal of Closure Drift Detection is:

> Given that the system is at L5 today, detect any change that degrades it — before merge.

---

## Four Closure Stability Principles

### P1 — Closure Completeness

**Statement:** Closure is not a binary property. It is the simultaneous satisfaction of all R1–R5 conditions. Passing 4 of 5 rules is not "almost closed" — it is not closed.

**Verification:** `check:closure` must pass ALL rules, not a subset. Partial closure acceptance is a P1 violation.

**Violation signal:** "R3 fails but the rest pass — let's ship anyway"

---

### P2 — Enforcement Reality

**Statement:** A rule that exists only in documentation does not exist. A rule exists if and only if there is a CI check that fails when the rule is violated.

**Correct form:**
- Rule written in docs + CI script enforcing it → rule exists
- Rule written in docs only → rule does not exist (P2 violation)
- CI script present but not in `npm test` or required workflow → rule does not exist

**Violation signal:** "We documented not to do X" without a `check:X` script that exits 1 when X occurs.

---

### P3 — Stability Under Evolution

**Statement:** A closure property is stable if and only if any future code change that degrades it is automatically detected before merge.

**What "stable" requires:**
1. A baseline recording the current violation count per rule
2. A drift check comparing live violation count vs baseline
3. Drift check runs in CI on every PR

**Violation signal:** Closure is verified once at a point in time, but not continuously monitored. Result: "gradual degradation" — the system drifts from L5 to L4 or L3 undetected over multiple PRs.

**Anti-pattern:** "We verified L5 when we built the check — surely it hasn't changed."

---

### P4 — Leakage Detection

**Statement:** Closure must be evaluated for potential escape paths, not just current violation count. An exception list that grows is a leakage point even if individual items are justified.

**What to check:**
- Exception lists (e.g., `TRACE_DEEPEQUAL_ALLOWED_FILES`) — track count over time
- Cross-repo path assumptions — fragile if repo structure changes
- Type-system gaps (e.g., `as any`) — runtime-safe but type-unsafe paths exist

**Stable exception format:** Exceptions should be semantic (what kind of operation is allowed), not file-based (which files are allowed). File-based exceptions grow; semantic-based exceptions remain bounded.

**Violation signal:** Exception list has grown since last baseline. Even if each addition was individually justified, the trend indicates leakage.

---

## Drift Detection Architecture

### Baseline

```json
// scripts/lib/closure-baseline.json
{
  "rules": {
    "R1": { "violations": 0, "exceptions": 1 },
    "R2": { "violations": 0, "exceptions": 0 },
    "R3": { "violations": 0, "exceptions": 0 },
    "R4": { "violations": 0, "exceptions": 0 },
    "R5": { "violations": 0, "exceptions": 0 }
  },
  "recorded_at": "<ISO date>",
  "closure_level": 5
}
```

### Drift signal

```
current violations > baseline violations → DRIFT (degradation)
current exceptions > baseline exceptions → DRIFT (exception leakage)
```

### Update protocol

Baseline is updated ONLY when a violation or exception increase is intentional and reviewed:

```
1. Explain why the exception/violation is acceptable
2. Document in ADR or journal
3. Run: npm run check:closure-drift -- --record
4. Commit baseline update with explanation in commit message
```

Silently running `--record` to suppress a drift warning is a P2 violation (enforcement bypassed).

---

## Relationship to Other Principles

| Principle | Relationship |
|-----------|-------------|
| CLOSURE.md R1–R5 | Drift detection monitors these rules — CLOSURE.md defines what to monitor |
| P1 Enforcement > Documentation | P2 (Enforcement Reality) is the drift-specific instance of P1 |
| EM7 Guard Rails Before Execution | Drift check is a guard rail for every future PR, not just Phase 3 |
| P3 Sample Passing ≠ Proof | Passing check:closure once is a sample — continuous drift detection is the invariant |

---

## History

- B009: initial definition, implemented as `check:closure-drift.mjs` + `closure-baseline.json`
