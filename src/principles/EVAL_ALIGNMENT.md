# Evaluation Alignment — Principles for Benchmark and Agent Systems

**Canonical source for:** `.claude/rules/eval-alignment.md` (behavioral adapter)
**Machine-checkable file:** `src/principles/eval-alignment.ts` (runtime checks)

**Origin:** Extracted from SWE-bench incident — local import errors misclassified as patch
failures because the evaluation environment (Docker) was not confirmed before building gates.

---

## The Core Problem

Systems that evaluate agents produce *signals*. Those signals are only meaningful when
the evaluation environment matches the benchmark's intended execution model.

When the environment is wrong:
- A correct patch looks like a failure (false negative)
- A broken gate looks like it works (false positive)
- All "quality improvements" are noise

Principle: **Align the evaluation boundary before building any quality signal.**

---

## Eight Principles

### EA1 — True Evaluation Boundary First

Before any implementation, identify:
- Which process executes the tests (local Python / Docker / CI / remote sandbox)
- Who declares pass/fail (local pytest / harness / hidden evaluator)
- Whether local passing equals official passing

**Checkable invariant:** Any system that produces quality signals must declare its
evaluation method. Undeclared evaluation method = EA1 violation.

---

### EA2 — No Default Run Pattern

Never assume `git clone → pip install → pytest` is correct for benchmarks.
The canonical path may require:
- Pre-built Docker images with compiled dependencies (`swebench/sweb.eval.x86_64.*`)
- Conda environment activation (`conda activate testbed`)
- Specific working directory (`/testbed`, not `.`)
- Hidden evaluator running separately

**Checkable invariant:** If a system catches `ImportError` or `ModuleNotFoundError`
to decide test quality, and the benchmark uses Docker images, this is EA2 violation.

---

### EA3 — Evaluation Loop Before Agent Optimization

Correct order:
1. Run one official instance end-to-end
2. Confirm evaluator produces meaningful signal
3. Confirm output format matches evaluator input
4. Only then optimize prompts, gates, retry logic

**Checkable invariant:** Agent quality metrics must not be reported before the
evaluation loop is confirmed closed for at least one canonical instance.

---

### EA4 — Failure Layer Classification

Every failure must be classified into one of:
- `task_failure`: the patch is genuinely wrong
- `environment_failure`: dependencies/container/cwd missing or wrong
- `harness_mismatch`: running a different evaluator than official
- `observation_failure`: insufficient data to classify

Only `task_failure` is evidence of agent quality. Others require environment fix first.

**Checkable invariant:** A result labeled `rejected` or `failed` must have a
declared failure layer. Missing layer = unclassified failure = EA4 violation.

---

### EA5 — Fallbacks Preserve Liveness, Not Truth

A fallback (e.g., apply-gate-only, skip-test-gate) is permitted to:
- Prevent system crash on environment failure
- Mark result as uncertain
- Allow run to continue

A fallback is NOT permitted to:
- Be used as the final quality verdict
- Be mixed with confirmed-quality results in the same metric bucket
- Replace the correct evaluation path permanently

**Checkable invariant:** Results accepted via fallback gate must carry a distinct
label (`accepted_apply_gate_only`, not `accepted`). Mixed labeling = EA5 violation.

---

### EA6 — Evaluation Semantics Must Be Declared

Any score, pass rate, or improvement metric must state:
- Which evaluator was used (official harness / local pytest / apply gate)
- Which instances were evaluated via fallback vs. full harness
- Whether the score is comparable to the official leaderboard

**Checkable invariant:** A run summary that reports a pass count without an
`evaluation_method` field is an EA6 violation.

---

### EA7 — Document Check Before Implementation

For any unfamiliar benchmark: read before coding.

Required reading order:
1. README Quickstart
2. README Evaluation section
3. Baseline implementation (one working example)
4. Known issues / FAQ
5. Docker/environment setup

**Checkable invariant (behavioral):** Cannot claim "aligned with official evaluation"
without having read the benchmark's evaluation documentation. Enforced by plan doc
`## Principles Check` requiring EA1–EA8 status.

---

### EA8 — Separate Observation Gate from Quality Gate

Two distinct gates, not one:

**Observation gate:** Can the test runner execute in the correct environment?
- Docker available
- Correct conda environment activated
- Import succeeds
- Test file exists

**Quality gate:** Did the patch fix the issue?
- FAIL_TO_PASS tests now pass
- No PASS_TO_PASS regressions

If observation gate is undefined or failed, quality gate result is undefined.

**Checkable invariant:** A quality gate must not fire when the observation gate
has not been confirmed. Combined gate that handles both = EA8 violation.

---

## Principles Check Table (for plan docs)

```markdown
## Principles Check (EA1–EA8)

| Principle | Status | Notes |
|-----------|--------|-------|
| EA1 Evaluation boundary identified | pass/fail | |
| EA2 No default run pattern assumed | pass/fail | |
| EA3 Evaluation loop closed first | pass/fail | |
| EA4 Failure layers classified | pass/fail | |
| EA5 Fallbacks labeled, not promoted | pass/fail | |
| EA6 Evaluation method declared | pass/fail | |
| EA7 Docs read before coding | pass/fail | |
| EA8 Observation gate separate from quality gate | pass/fail | |
```

Any `fail` → stop and fix before proceeding.

---

## Relationship to Other Principles

- `SYSTEM_PRINCIPLES.md` P1 — enforcement: evaluation method must be structurally declared
- `SYSTEM_PRINCIPLES.md` P6 — isolation: environment failures must be isolated from task failures
- `EXECUTION_MODEL.md` EM7 — guard rails: evaluation loop must close before optimization begins
- `CLOSURE.md` R5 — observable verification: all behavior verifiable from observable outputs
