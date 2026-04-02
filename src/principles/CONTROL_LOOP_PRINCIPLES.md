# Control Loop Governance Principles

**Home:** `jingu-policy-core/src/principles/`
**Companion:** `~/.claude/rules/control-loop-principles.md` — behavioral guide for when to apply these
**Status:** Canonical definition. Customer-importable.
**Enforced at:** `.claude` layer (IGF, DBO — LLM behavior), runtime layer (NBR, EFR — hard checks in runner)

These principles govern the **control loop**: the sequence of attempt → observe → diagnose → retry. They encode the correct priority ordering so the system cannot optimize before it can observe.

Immediate trigger: SWE-bench experiment (2026-04-02) showed Claude proposing step_limit reduction before execution feedback channel was confirmed working. This is the exact anti-pattern these principles prevent.

---

## IGF — Information Gain First

> Any change to system behavior must increase observability or diagnostic signal **before** adjusting runtime parameters.

**Correct pattern:**
1. Add execution feedback channel (observability)
2. Add failure classification (diagnostic signal)
3. Only then tune step_limit / timeout / workers

**Violation signals:**
- Proposing step_limit / timeout change when feedback loop is incomplete
- "Let's first reduce the step count" before test output is being captured
- Treating runtime parameter tuning as a first-class improvement

**Anti-pattern example:**
```
Problem: attempt takes 15 min, we don't know why it fails
Wrong:   step_limit = 100 → 40  (reduces time, adds no information)
Right:   add exec_feedback extraction → now you know WHY it fails
         then step_limit = 40 (now a meaningful constraint, not a guess)
```

**Machine-checkable invariant:**
```
if change.changes_runtime_param AND NOT change.adds_observability AND NOT change.adds_failure_signal:
    VIOLATION: IGF
```

---

## NBR — No Blind Retry

> Retry (attempt N+1) must be based on structured failure signals. Empty or vague hints are forbidden when execution evidence is available.

**Correct pattern:**
```
attempt 1 fails
→ extract: failure type, failing test names, output excerpt
→ attempt 2 receives: structured hint with concrete evidence
```

**Violation signals:**
- `last_failure = ""` when attempt 1 ran tests
- `last_failure = "Previous attempt failed. Try again."` when test names are available
- Retry hint that does not reference any concrete observable

**Anti-pattern example:**
```python
# WRONG — blind retry
last_failure = "Previous attempt failed"

# RIGHT — grounded retry
last_failure = (
    "Tests ran: 3 failed, 0 errors.\n"
    "Failing: tests.admin.FormsMediaTestCase.test_merge_js_three_way\n"
    "Excerpt: AssertionError: Lists differ: expected topological order..."
)
```

**Runtime enforcement:** `run_with_jingu_gate.py` raises `RuntimeError("NBR violation")` if `last_failure` is empty when `attempt > 1`.

---

## EFR — Execution Feedback Required

> When execution (tests) ran in attempt N, its output MUST be structurally captured and fed into attempt N+1's decision context.

**Correct pattern:**
```
jingu_body.test_results.ran_tests = True
→ build_execution_feedback() extracts: counts + failing names + excerpt
→ exec_feedback != ""
→ last_failure includes exec_feedback
```

**Violation signals:**
- `jingu_body.ran_tests = True` but `exec_feedback = ""`
- Test output in traj but not extracted into retry hint
- Retry controller called without execution signal input

**Three required layers (in order):**
1. `summary` — failure count, error count (always)
2. `failing_tests` — names of FAIL_TO_PASS tests that failed (if available)
3. `excerpt` — last 1500 chars of `<output>` tag from test tool call (compressed signal)

**Runtime enforcement:** `run_with_jingu_gate.py` raises `RuntimeError("EFR violation")` if `tests_ran=True` and `exec_feedback=""`.

---

## DBO — Diagnosis Before Optimization

> Runtime parameter tuning (step_limit, timeout, workers, retry count) is forbidden unless failure is classified. Classification requires at least one of: failure type, failing test names, execution output excerpt.

**Correct pattern:**
```
1. Run experiment
2. Classify failure: "agent hits step limit without finding target file" (exploration loop)
3. Then: reduce step_limit to force earlier convergence
```

**Violation signals:**
- Reducing step_limit "to save time" without knowing why agent is slow
- Increasing timeout "to let it finish" without knowing what it's doing
- Changing workers/parallelism before understanding single-instance failure mode

**Failure classification taxonomy (minimum required for runtime tuning):**

| Type | Signal | Correct response |
|------|--------|-----------------|
| exploration_loop | many reads, no writes, no patch | reduce step_limit + add target file hint |
| wrong_direction | patch growing + same file + test still failing | retry with must_not_do constraint |
| test_not_found | test runs but FAIL_TO_PASS not triggered | check test name format |
| environment_failure | import error / container crash | fix environment, not parameters |

**Machine-checkable invariant:**
```
if change.tunes_runtime_param AND NOT change.has_failure_classification:
    VIOLATION: DBO
```

---

## Priority Ordering

When the control loop is incomplete, apply in this order:

```
1. EFR — can we observe what happened?      (precondition for everything)
2. NBR — does retry have concrete signal?    (precondition for useful retry)
3. DBO — is failure classified?             (precondition for tuning)
4. IGF — does any change add information?   (governs all changes)
```

Any system that tunes runtime parameters before step 1–3 is violating this ordering.

---

## Relationship to Other Principles

| Principle | Relationship |
|-----------|-------------|
| `probe-until-signal.md` (P7) | Complementary. P7 governs *when to stop probing*. These govern *what to do with failure signal*. |
| `execution-model.md` (EM7) | Complementary. EM7 = guard rails before execution. DBO = diagnosis before tuning. Same direction. |
| `system-principles.md` (P8) | Root. System > human discipline. These principles make feedback mandatory, not habitual. |
| `EVAL_ALIGNMENT.md` (EA3) | Complementary. EA3 = close eval loop before optimizing. EFR = close feedback loop before retrying. |
