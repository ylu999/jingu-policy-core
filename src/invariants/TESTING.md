# Invariants Subsystem — Testing Requirements

## Per-invariant requirements

Every invariant function must have:
- **At least 1 positive case**: input that satisfies the invariant → `pass()` returned
- **At least 1 negative case**: input that violates the invariant → `fail()` with the correct code

## Result model requirements

`mergeResults()` must be tested with:
- All pass → `{ ok: true, failures: [] }`
- Mix of pass and error-severity fail → `ok: false`
- Warning-only failures → `ok: true` (warnings do not block)
- Empty array → `{ ok: true, failures: [] }`

## Runtime invariant requirements

For `validateRuntimeExecution()`:
- At least 1 integration test showing a valid input returns `pass()`
- At least 1 integration test showing a scope violation returns `fail()` with `SCOPE_VIOLATION`

## Event invariant requirements

For `checkLoopEventSequence()`:
- At least 1 replay test: write a valid event sequence → checkLoopEventSequence passes
- At least 1 sequence error: retry_requested before attempt_started → fails with `INVALID_EVENT_SEQUENCE`
- At least 1 missing precondition: events reference attempt_id with no attempt_started → fails

## Multi-agent invariant requirements

- Orchestrator write → pass (not blocked)
- Candidate non-write → pass
- Candidate write → fail with `CANDIDATE_WRITES_CANONICAL_STATE`
- Merged + verified → pass
- Merged + not verified → fail with `MERGED_RESULT_NOT_REVERIFIED`
- Not merged (either verify value) → pass

## Code coverage expectation

Every code in `InvariantCodes` that has a corresponding check function must appear in at least one test's expected `failure.code`.
