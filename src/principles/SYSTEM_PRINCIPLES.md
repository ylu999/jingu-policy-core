# Jingu System Principles v1 — Executable Edition

**Home:** `jingu-policy-core/src/principles/`
**Status:** Canonical definition. Enforcement scripts live in consumer repos (jingu-agent/scripts/).

Each principle has:
- A definition (what it requires)
- A violation signal (how to detect it)
- An enforcement point (where it must be checked)

---

## P1 — Enforcement over Documentation

> System behavior must be enforced by mechanism, not by convention or documentation.

**Violation:**
- A rule exists but can be bypassed
- Same logic implemented in multiple places (e.g., two normalizeTrace() functions)

**Formal statement:**
```
∀ critical rule R:
  ∃ enforcement mechanism M:
    violation(R) → system fails
```

**Current enforcement map:**
- normalize → assertTraceEquivalence() is the only legal entry point
- boundary → check:boundary script (jingu-agent)
- invariant → check:invariant script (jingu-agent)

**Enforcement script:** `check-boundary.ts`, `check-trace-usage.ts`

---

## P2 — Critical Paths Must Be Guarded

> Any component whose deletion would cause the system to be silently wrong is a critical path and must be explicitly protected.

**How to identify a critical path:**
If deleting a component causes silent wrong behavior (not a build error, not a test failure — just wrong output), it is critical.

**Current critical paths:**
- `tests/unit/governance/loop-events-integration.test.ts`
- Trace emission chain: loop → emitter → sink
- normalize contract in @jingu/trace

**Formal statement:**
```
critical_component:
  - cannot be deleted silently
  - must be executed in CI
  - must fail fast on violation
```

**Enforcement script:** `check-critical-tests.ts`

---

## P3 — Sample Passing is Not Proof

> A test passing once only proves "no problem was found in this case". It does not prove the system is correct.

**Violation:**
- "N/N tests pass" is treated as a correctness proof
- No invariant checks or property-based tests

**Required for correctness:**
```
correctness must be established by:
  - invariants (machine-checkable) OR
  - property-based tests OR
  - exhaustive constraints
```

**Current system mapping:**
- check:invariant: event graph causal completeness, ordering, measurement correctness
- future: property-based trace test (randomized inputs, same scenario → same normalized trace)

**Enforcement script:** `check-invariant.ts`

---

## P4 — Make Illegal States Unrepresentable

> The system must be designed so that invalid states cannot be constructed, not just detected after the fact.

**Violation:**
- bypass of normalize is syntactically valid
- bypass of boundary is syntactically valid
- deletion of critical test compiles and passes CI

**Formal statement:**
```
invalid_state ∉ reachable_states
```

**Current enforcement approaches:**
- assertTraceEquivalence() as single API — direct deepEqual has no normalize → type error (long-term: TypeScript branded types)
- check:boundary runs before merge — direct loop-emitter import → CI fail
- check:critical-tests runs before merge — deleted guardian test → CI fail

**Long-term enforcement:** TypeScript branded types for NormalizedTrace vs RawTrace (prevents passing raw to comparison function). See B006.

### P4a — Single Entry Point (sub-principle of P4)

> If a behavior has multiple entry points, it will be misused.
> The correct state must be reachable through exactly one path; all other paths must be blocked.

**Trace system instance:**
```
assertTraceEquivalence()  ← the ONE legal comparison path
  │
  ├── stripVolatileFields()    ← removes per-run noise (NORMALIZE_WHITELIST)
  └── policyNormalize()        ← structural normalization (parent_index, NormalizedEvent)

❌ calling either layer function directly for comparison = illegal
```

**Why rename alone is not enough:**
Renaming `normalizeTrace → stripVolatileFields` makes the two functions distinguishable but does not prevent a developer from calling `deepEqual(stripVolatileFields(a), stripVolatileFields(b))` — which skips structural normalization and produces a false equivalence check. The entry point must be enforced structurally (type system) and statically (lint).

### P4b — API Defines Correctness (sub-principle of P4)

> The correct way to use a system is defined by its API surface, not by documentation.
> If the correct path is not the only path, the API is incomplete.

**Implication for design:**
When designing any function that can be misused:
1. Ask: "Is there a simpler path that looks equivalent but is semantically wrong?"
2. If yes: remove that path, or make the correct path the only one that compiles
3. Documentation explaining the correct path is a sign the API is incomplete

**Trace system instance:**
- Correct: `assertTraceEquivalence(a, b)`
- Looks equivalent but wrong: `assert.deepEqual(normalizeTrace(a), normalizeTrace(b))` — skips volatile field stripping
- Fix: type system (B006) prevents passing RawTrace to policyNormalize; lint (B007) prevents the pattern in test code

---

## P5 — Stability Before Snapshot

> Snapshot baselines may only be pinned after system behavior is stable. Pinning before stability means the snapshot changes repeatedly, providing false signal.

**Violation:**
- Trace snapshot pinned during active refactor
- Snapshot changes on every PR

**Formal statement:**
```
if system not stable:
  snapshot_pinning = forbidden
```

**Current decision:**
- B003b (trace snapshot) blocked until Phase 3 (clean jingu-agent) is complete
- Rationale: loop structure may still change during agent cleanup

---

## P6 — Separate Orthogonal Concerns

> Problems must be in exactly one of two states: fixed or explicitly isolated. A third state (present but ignored) is not allowed.

**Violation:**
- benchmark TS errors: broken but excluded from validation without explicit isolation declaration
- Any system where "it's known broken but not our problem" is undocumented

**Formal statement:**
```
problem ∈ {fixed, isolated}
```
No third state. Isolation requires: explicit decision, documentation in journal, separate script/tsconfig, named backlog entry.

**Current decision:** benchmark TS errors → formally isolated in B003a-6 (separate tsconfig + backlog B005)

---

## P7 — Meta-Fix over Local Fix

> Prefer fixing the mechanism that produces errors over fixing individual errors. A meta-fix prevents a class of future errors; a local fix removes one instance.

**Violation:**
- Manual fixes to repeated instances of the same error
- No structural prevention of recurrence

**Formal statement:**
```
for bug B:
  fix(root_cause(B)) > fix(B)
```

**Current system mapping:**
- CI checks (boundary / invariant / trace) → meta-fix for class of boundary violations
- normalize contract → meta-fix for class of ad-hoc strip operations
- guardian test → meta-fix for "important test gets deleted"

---

## P8 — System > Human Discipline

> System reliability must come from structural constraints, not developer habits.
> "Remember to do X" is not a system constraint.

**Violation:**
- "Everyone knows not to bypass normalize"
- Relying on code review to catch boundary violations

**Formal statement:**
```
human_error → system catches
```

**Current system mapping:**
- CI: catches boundary violations before merge
- Runtime: invariant checks catch malformed traces
- long-term: type system prevents invalid state construction (P4)

---

## Usage Guide

### As a review tool

Ask 3 questions about any proposed change:
```
1. Can this rule be bypassed? (P1, P4)
2. If this component is deleted, does the system fail silently? (P2)
3. Is this verification sample-based or invariant-based? (P3)
```

### As a design tool

For every new module:
```
- Which principle does this enforce?
- If it enforces nothing, is it documentation or mechanism?
```

### As a priority tool

```
P1 / P4 issues → must fix first (system can be silently wrong)
P2 issues     → fix next (critical path unguarded)
P3 issues     → enhancement (correctness improvement)
P5 / P6       → architectural decisions (timing/isolation)
P7 / P8       → systemic improvement (meta-level)
```

---

## Relationship to other principle files

| File | What it governs |
|------|----------------|
| `SYSTEM_PRINCIPLES.md` (this file) | Meta-level: how the system enforces its own rules |
| `trace.ts` | Trace-specific: causal completeness, semantic precision, measurement, determinism, reconstructability |
| `PRINCIPLES.md` | Trace principle names + machine-checkable check function index |
| `~/.claude/rules/trace-semantics.md` | When to apply trace principles (Claude behavioral guide) |
| `~/.claude/rules/design-audit.md` | When to apply loop design principles (Claude behavioral guide) |
