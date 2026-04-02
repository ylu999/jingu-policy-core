# Failure Taxonomy — Control Loop Failure Classification

**Home:** `jingu-policy-core/src/principles/`
**Companion:** `~/.claude/rules/control-loop-principles.md` (DBO principle)
**Status:** Canonical definition. Customer-importable.

Failure classification is the precondition for any runtime tuning (DBO principle).
Classify first. Intervene second. Tune parameters last.

---

## Five Failure Types

### FT1 — wrong_direction

The agent found the right file but its fix is logically incorrect, and each retry makes the patch larger without improving test results.

**Detection signals:**
- `files_changed = False` (same file across attempts)
- `size_delta > +30 lines` (patch growing)
- `same_admission_reason = True`
- Tests ran but still failing

**Root cause:** Agent does not know its solution strategy is wrong. It keeps adding code to an incorrect approach (e.g., warning suppression instead of algorithm fix).

**Information gap:** Missing execution-level feedback explaining *why* the tests fail.

**Correct intervention:**
- `must_not_do`: name the incorrect strategy explicitly
- `must_do`: state the correct algorithm/approach
- exec_feedback: inject failing test names + excerpt

**Wrong intervention:** Reduce step_limit. This just makes the wrong approach arrive faster.

---

### FT2 — exploration_loop

The agent reads files, greps, and explores, but never commits to a fix or produces a meaningful patch.

**Detection signals:**
- No patch written (or empty patch)
- No tests ran
- Agent exit ≠ Submitted (often LimitsExceeded or timeout)
- High API call count relative to patch size

**Root cause:** Agent is in an undirected search. Lacks a concrete target.

**Information gap:** Missing target file hint or scope constraint.

**Correct intervention:**
- `must_do`: name the specific file(s) to focus on
- `must_do`: name the specific function to modify
- Reduce scope: one file, one function, minimal change

**Correct parameter response:** step_limit reduction is valid here (after classification), because shorter budget forces earlier commitment.

---

### FT3 — no_effect_patch

The agent submits a patch, tests run, but the patch has no observable effect on test outcomes. Failure pattern is identical before and after.

**Detection signals:**
- Patch written (non-empty diff)
- Tests ran
- Same failing tests, same failure message
- `size_delta` may be small or zero across attempts

**Root cause:** Agent modified the wrong part of the code — structurally correct patch, semantically irrelevant.

**Correct intervention:**
- `must_do`: point to specific line/function that the failing test exercises
- exec_feedback: include exact assertion failure to pinpoint wrong location

---

### FT4 — test_not_triggered

The agent submits a patch but the required tests were never executed. No test signal available.

**Detection signals:**
- `jingu_body.test_results.ran_tests = False`
- Patch written but no test output
- Agent submitted without verifying

**Root cause:** Agent submitted prematurely, or used wrong test invocation command.

**Correct intervention:**
- `must_do`: run the FAIL_TO_PASS tests explicitly before submitting
- `must_do`: include exact test command
- `must_not_do`: do not submit without running tests first

---

### FT5 — environment_failure

The agent cannot execute because of environment issues: import errors, container crashes, missing dependencies.

**Detection signals:**
- Non-zero exit status with no test failures detected
- Import error / module not found in output
- Agent exit = Error (not LimitsExceeded, not Submitted)

**Root cause:** Environment problem, not code problem.

**Correct intervention:** Fix the environment. Do not modify application code.
**Wrong intervention:** Any code change. Environment must be resolved first.

---

## Detection Priority Order

Apply in this order (first match wins):

```
1. environment_failure  — check exit_status + import errors
2. test_not_triggered   — check ran_tests = False
3. exploration_loop     — check no patch produced
4. wrong_direction      — check same_files + size growing + tests still failing
5. no_effect_patch      — check patch written + tests ran + failure unchanged
```

---

## Intervention → Parameter Mapping

| Failure type        | step_limit | timeout | hint type          |
|---------------------|------------|---------|-------------------|
| wrong_direction     | no change  | no change | must_not_do + direction |
| exploration_loop    | reduce     | no change | target file + scope |
| no_effect_patch     | no change  | no change | exact location hint |
| test_not_triggered  | no change  | no change | run tests command |
| environment_failure | no change  | no change | fix environment first |

Only `exploration_loop` justifies step_limit reduction. All others require hint changes, not parameter changes.
