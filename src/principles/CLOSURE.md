# System Closure Principles

**Canonical definition.** This file is the source of truth for System Closure.
Consumer-facing behavioral guide: `~/.claude/rules/system-closure.md`
Machine-checkable enforcement: `scripts/check-closure.mjs` in jingu-agent

---

## Definition

A system is **closed** when three conditions hold simultaneously:

1. **Path Closure** — Every legal execution path is defined, reachable, and terminates with a verifiable outcome.
2. **Illegal Path Elimination** — Every execution path that is not explicitly legal is structurally blocked (by types, lint, or CI), not merely undocumented.
3. **Observable Verification** — Every behavior claim about the system can be verified from observable outputs (events, invariants, test assertions) without reading source code.

A system that satisfies only 1 and 3 is **documented but not closed** — illegal paths still exist.
A system that satisfies only 1 and 2 is **enforced but not verifiable** — you cannot confirm it works correctly.
All three are required.

---

## Closure Levels (L0–L5)

Used to communicate system maturity and track progress toward full closure.

| Level | Name | Description |
|-------|------|-------------|
| **L0** | Unstructured | No formal paths defined. Behavior is implicit or ad hoc. |
| **L1** | Documented | Legal paths are described in documentation. No enforcement. |
| **L2** | Typed | Types prevent some illegal states. No runtime or lint enforcement. |
| **L3** | Enforced | CI scripts block at least the most critical illegal paths. No observable verification. |
| **L4** | Verified | Critical paths have observable verification (tests, invariants). Some illegal paths may remain open. |
| **L5** | Closed | All three closure conditions satisfied. Legal paths defined, illegal paths blocked, all behavior verifiable. |

**Current target:** L5 (all R1–R5 pass).

**Rubric for evaluation:**
- Reaches L3 when: R3 (Enforcement Present) passes
- Reaches L4 when: R3 + R4 (Canonicalization Correct) + R5 (Observable Verification) pass
- Reaches L5 when: all R1–R5 pass

---

## Closure Rules (R1–R5)

These map directly to the `check:closure` CI evaluator in jingu-agent.

### R1 — Single Entry Point

Every trace comparison must go through `assertTraceEquivalence()`.
Direct use of `deepEqual()` on trace data (in any file that also references trace types) is an illegal path.

**Violation:** `deepEqual(` + trace keyword in the same file, without `assertTraceEquivalence`
**Why:** Direct comparison bypasses canonicalization (policyNormalize + volatile field stripping), producing false diffs on equivalent traces.

---

### R2 — No Illegal Paths

Internal normalization primitives (`stripVolatileFields`, `normalizeTrace`) must not be called directly outside their designated entry point (`assert.ts`).

**Violations:**
- `stripVolatileFields(` outside `assert.ts`
- `normalizeTrace(` outside `assert.ts` (excluding import type)

**Why:** Calling these directly creates ad hoc comparison paths that bypass the two-layer canonicalization contract defined in `assert.ts`.

---

### R3 — Enforcement Present

All required CI enforcement scripts must be registered in `package.json`.

**Required scripts:** `check:boundary`, `check:invariant`, `test:guardian:trace`, `check:trace-usage`

**Why:** A principle that is not enforced by CI is documentation, not enforcement (P1: Enforcement > Documentation).

---

### R4 — Canonicalization Correct

The single entry point (`src/assert.ts`) must use `policyNormalize` for structural canonicalization.

**Required:** `policyNormalize` present in `src/assert.ts`

**Why:** Without structural normalization (parent UUID → parent index), two equivalent traces with different run IDs will compare as non-equal, producing false failures.

---

### R5 — Observable Verification

The system must have machine-verifiable proof that its invariants hold.

**Required files:**
- `scripts/check-invariant.mjs` — runs `checkAllTracePrinciples()` on fixed scenarios
- `tests/unit/governance/loop-events-integration.test.ts` — guardian test (7 scenarios)

**Why:** Without observable verification, the system may be "enforced" but not confirmed correct. R5 closes the loop between enforcement and correctness.

---

## Closure Checklist

Run this checklist at: end of any refactor, completion of any new feature, any system evolution node.

Answer YES or NO. Any NO = system is not closed at L5.

```
1. Is there a single, enforced entry point for every critical operation?
   (trace comparison → assertTraceEquivalence, schema validation → validateDocument, etc.)

2. Are all illegal paths structurally blocked?
   (not just "documented as discouraged" — blocked by CI, types, or lint)

3. Is every behavior claim verifiable from observable outputs alone?
   (can you answer "why did this fail?" from the event log, without reading source code?)

4. Do all required CI checks pass?
   (check:boundary, check:invariant, check:trace-usage, test:guardian:trace)

5. Does check:closure report CLOSURE: PASS (L5)?
```

---

## Relationship to Other Principles

| Principle | Relationship |
|-----------|-------------|
| P1 Enforcement > Documentation | R3 is the direct application of P1 to closure |
| P2 Critical Paths Guarded | R1 + R2 together enforce P2 for trace comparison |
| P4a Single Entry Point | R1 is the closure check for P4a |
| EM7 Guard Rails Before Execution | Closure must be confirmed before Phase 3 begins |
| Trace Semantics (P1–P5) | CLOSURE R4+R5 depend on trace semantics holding |

Full principle definitions:
- `src/principles/SYSTEM_PRINCIPLES.md` — P1–P8
- `src/principles/EXECUTION_MODEL.md` — EM1–EM7

---

## History

- B003a-Closure: initial definition, L5 target confirmed
- First closure check run: all R1–R5 pass → CLOSURE: PASS (L5)
