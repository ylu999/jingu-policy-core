# Invariants Subsystem — Architecture

## Formal Statement

For every transition `t` in a Jingu execution:

1. `t.verify != null` — every transition declares a verify step
2. `t.verify` is bound to observable evidence — verification is not self-referential
3. state advances iff `verify.pass == true` — state is gated on evidence
4. if `verify.pass == false`, state remains unchanged — no partial advance
5. every failure is typed (has a `code`) — untyped failures are not traceable
6. every accepted mutation is within declared scope — scope is enforced
7. every committed result is replayable from recorded evidence — audit trail is complete

---

## Three Invariant Layers

### Layer A — Schema (static, compile-time / validation-time)

Checked before execution begins. Violations block task acceptance.

| Code | Severity | Description |
|------|----------|-------------|
| MISSING_VERIFY | error | Task or transition has no verify declared |
| INVALID_VERIFY_SPEC | error | verify spec is structurally invalid |
| VERIFY_NOT_EVIDENCE_BASED | error | verify has no evidence_kind |

### Layer B — Runtime Safety (execution-time, hard fail)

Checked during execution. Violations block state advance.

| Code | Severity | Description |
|------|----------|-------------|
| TRANSITION_WITHOUT_PASSING_VERIFY | error | State change attempted before verify passes |
| STATE_CHANGED_WITHOUT_TRANSITION | error | State mutated with no transition record |
| NO_OBSERVABLE_OUTPUT | error | Expected outputs not observed |
| NO_OP_FORBIDDEN | error | No files changed and allow_no_op not set |
| SCOPE_VIOLATION | error | Files changed outside declared scope |
| NON_TYPED_FAILURE | error | A failure has no typed code |
| CANDIDATE_WRITES_CANONICAL_STATE | error | Candidate actor wrote canonical state |
| MERGED_RESULT_NOT_REVERIFIED | error | Merge not followed by passing verify |
| STALE_STATE_VERSION | error | State version is behind expected |
| INVALID_EVENT_SEQUENCE | error | Events in wrong order or missing preconditions |

### Layer C — Audit / Replay (asynchronous, warning until infra is ready)

Checked post-execution for observability and replay. Violations are warnings during migration.

| Code | Severity | Description |
|------|----------|-------------|
| MISSING_ATTEMPT_ID | warning | Non-final event missing attempt_id |
| MISSING_EVENT_STATUS | warning | Gate event missing status field |
| MISSING_DECISION_LOG | warning | No decision log recorded for this execution |
| NON_REPLAYABLE_EXECUTION | warning | Execution cannot be deterministically replayed |

---

## Compile vs Runtime Boundary

```
STATIC (Layer A)          RUNTIME (Layer B)         AUDIT (Layer C)
validateTaskDefinition()  validateRuntimeExecution() checkLoopEvent*()
  ↓                         ↓                          ↓
checkTransitionHasVerify  checkTransitionAdvanceAllowed checkLoopEventHasAttemptId
checkVerifyIsEvidenceBased checkExecutionHasObservableOutput checkLoopEventHasStatus
                          checkNoOpPolicy              checkLoopEventSequence
                          checkScope
                          checkFailuresAreTyped
                          checkCandidateCannotWriteCanonicalState
                          checkMergedResultWasReverified
```

---

## mergeResults semantics

`ok = false` iff any failure has `severity === "error"`.
Warnings accumulate in `failures` but do not affect `ok`.
This allows consumers to surface warnings while continuing execution.
