# Jingu Execution Model Principles v1

**Home:** `jingu-policy-core/src/principles/`
**Companion:** `~/.claude/rules/execution-model.md` — behavioral guide for when to apply these
**Status:** Canonical definition. Customer-importable.

These principles define HOW the system runs. All code, tests, and tools must be consistent with this model.

Relationship to SYSTEM_PRINCIPLES.md:
- SYSTEM_PRINCIPLES = design philosophy (why things are structured this way)
- EXECUTION_MODEL (this file) = runtime rules (how the system must behave)
- CI / code = enforcement (how violations are caught)

---

## EM1 — All State Transitions Are Gated

> Any operation that changes system state must pass through an explicit gate that validates preconditions, invariants, and policy.

**Violation signals:**
- LLM output directly modifies system state without validation
- State written by bypassing store gate
- Transition succeeds even when invariant check fails

**Must satisfy:**
```
state_change(op):
  precondition_check(op) AND invariant_check(op) AND policy_check(op)
  → only then: apply(op)
```

**Current system mapping:**
- trust-gate: validates evidence before state admission
- validateRPPBinding: structural gate before LLM output is admitted
- runGovernedLoop: gate chain (schema → binding → strictness → reviewer → verdict)

**Enforcement:** gate must be in the critical path — cannot be bypassed by caller

---

## EM2 — All Comparisons Are Canonicalized

> All equality checks on structured system data must operate on a canonical form, not on raw/volatile data.

**Violation signals:**
- `deepEqual(rawTraceA, rawTraceB)` — volatile fields (UUID, timestamp) cause false negatives
- Comparison that strips only some volatile fields but not all
- Two different canonicalization paths producing different results for semantically equal inputs

**Must satisfy:**
```
compare(a, b) ≡ compare(canonicalize(a), canonicalize(b))
```

**Current trace canonicalization (two-layer):**
```
canonicalize(raw: RawTrace):
  layer 1: stripVolatileFields(raw)        // remove: event_id, run_id, attempt_id, timestamp, duration_ms
  layer 2: normalizeTrace(stripped)         // structural: parent_event_id → parent_index
  → NormalizedEvent[]
```

**Enforcement:** `assertTraceEquivalence()` is the single legal comparison entry point (B003a). Direct `deepEqual` on trace data is forbidden (B007 lint check).

---

## EM3 — Single Entry Point for Critical Operations

> A critical operation must have exactly one legal entry point. Multiple entry points guarantee misuse.

**Violation signals:**
- Two functions that both perform "trace comparison" with different behavior
- Multiple import paths to the same logical function
- Documentation saying "you can also use X" for a critical operation

**Must satisfy:**
```
critical_op O:
  |legal_entry_points(O)| == 1
```

**Current system mapping:**
| Critical operation | Single entry point |
|-------------------|-------------------|
| Trace comparison | `assertTraceEquivalence()` |
| Loop event emission | `LoopEmitter` (via `@jingu/trace`) |
| LLM output admission | `runGovernedLoop()` gate chain |
| State mutation | store gate (future) |

**Enforcement:** check:boundary (B003a) + check-trace-usage lint (B007)

---

## EM4 — Execution Must Be Replayable

> Given the same input and a stored trace, it must be possible to re-run the system and produce an identical normalized trace. Non-determinism in the trace is a system defect.

**Violation signals:**
- Same input produces different event sequences on different runs (after normalization)
- Event ordering depends on wall-clock time or external randomness
- Trace cannot be compared across runs due to volatile fields polluting the comparison

**Must satisfy:**
```
∀ input I, scenario S:
  run(I, S) → trace_1
  run(I, S) → trace_2
  normalizeTrace(trace_1) == normalizeTrace(trace_2)
```

**Current system mapping:**
- NORMALIZE_WHITELIST defines the exact set of legitimately non-deterministic fields
- `normalizeTrace()` (policy-core) removes structural non-determinism
- `checkDeterminismInvariant()` machine-verifies this property

**Future enforcement:** B003b snapshot pinning + B008 replay system

---

## EM5 — Observability Is a First-Class Interface

> System state must be machine-readable, not just human-readable. Every event must be structured, typed, and causally linked.

**Violation signals:**
- Events are unstructured log strings
- No `parent_event_id` — causal chain cannot be reconstructed
- `payload` is free-form text or undocumented fields
- Events cannot be parsed by a machine to answer "why did this fail?"

**Must satisfy:**
```
event:
  event_id: UUID
  parent_event_id: UUID | absent (root)
  type: declared LoopEventType
  status: declared StatusValue
  payload: typed, documented
  attempt_id: attempt grouping key
```

**Current system mapping:**
- `LoopEvent` type in `@jingu/policy-core`
- `checkCausalCompleteness()`, `checkSemanticPrecision()`, `checkReconstructability()`
- `checkAllTracePrinciples()` — validates EM5 at runtime

---

## EM6 — Invariants Over Tests

> System correctness must be primarily established through structural invariants, not test coverage. Tests verify behavior; invariants prohibit incorrect behavior.

**Violation signals:**
- "N/N tests pass" used as correctness proof
- No machine-checkable invariants
- Tests can be deleted without changing system guarantees

**Must satisfy:**
```
system_correctness:
  invariants_hold(system) ∧ tests_pass(system)
  where invariants_hold is the stronger guarantee
```

**Relationship:**
- Invariant: "this state is structurally impossible" — `checkCausalCompleteness()` etc.
- Test: "this behavior was observed once" — `loop-events-integration.test.ts`
- Both are required; invariants take priority in case of conflict

**Current system mapping:**
- `checkAllTracePrinciples()` — EM6 at trace level
- check:invariant script (B003a) — EM6 at CI level
- Future: property-based testing for stronger guarantees (B-future)

---

## EM7 — Guard Rails Before Execution

> Any high-risk change must have guard rails in place before the change begins. "Add protection after" is not a valid pattern.

**Violation signals:**
- Refactoring code without prior CI enforcement
- "We'll add the invariant check after the refactor is done"
- Relying on code review as the only regression catch mechanism

**Must satisfy:**
```
if risk(change) > threshold:
  guard_rails(change) must exist BEFORE change begins
```

**Execution order rule (Precondition Enforcement):**
```
if step B prevents regression in step A:
  execute(B) before execute(A)
```

**Current system mapping:**
- B003a (CI safety: boundary + invariant + assertTraceEquivalence + guardian test) is a PREREQUISITE for Phase 3
- Phase 3 (clean jingu-agent) must not begin until B003a checks are active
- B003b (snapshot) is a prerequisite for B008 (replay)

**Principles driving EM7:**
- Safety Before Evolution: constraints before changes
- Guard Rails First: no high-risk execution without catch mechanism
- Precondition Enforcement: protection must precede the thing it protects
- Risk Containment: errors must be caught at the minimum possible blast radius

---

## Execution Order Model

The four principles above produce a canonical execution order rule:

```
1. Define invariants (what must always be true)
2. Build guard rails (what catches violations)
3. Make guard rails active (CI, runtime)
4. Execute changes under guard rails
5. Pin snapshot (behavior is now stable)
6. Build replay (can verify historical behavior)
```

**Applied to current migration:**
```
Phase 1 (freeze jingu-policies)     ← done
Phase 2 (fill jingu-trace)          ← done
B003a (CI guard rails)              ← next — PREREQUISITE for Phase 3
Phase 3 (clean jingu-agent)         ← under B003a guard rails
B003b (trace snapshot)              ← after Phase 3 stabilizes
B008 (trace replay)                 ← after B003b
```

---

## Relationship to other principle files

| File | Layer | What it governs |
|------|-------|----------------|
| `EXECUTION_MODEL.md` (this file) | Runtime rules | How the system must execute |
| `SYSTEM_PRINCIPLES.md` | Design philosophy | Why the system is structured this way |
| `trace.ts` | Domain-specific | Trace causal completeness, determinism, reconstructability |
| `~/.claude/rules/execution-model.md` | Behavioral guide | When Claude should check these principles |
| `~/.claude/rules/system-principles.md` | Behavioral guide | When Claude should apply P1-P8 |
