# Evaluation Alignment — Principles for Benchmark and Agent Systems

**Canonical source for:** `.claude/rules/system-mental-model.md` (behavioral adapter)
**Machine-checkable file:** `src/principles/eval-alignment.ts` (runtime checks)

**Origin:** SWE-bench incident — local import errors misclassified as patch failures because
the Docker evaluation environment was not confirmed before building gates and optimizing prompts.

---

## Core Gate

```
If you have not confirmed:
  1. HOW the system runs
  2. HOW success is evaluated

You are not ready to modify or extend it.
```

This is not documentation-compliance. It is a correctness precondition.

---

## System Mental Model Principles (SM1–SM5)

These are the conceptual layer. EA1–EA8 are the checkable operational invariants.

### SM1 — Identify the System, Don't Assume It

Before using any system, answer:
- What is its execution model? (Docker / local / CI / remote sandbox)
- How is success defined? (test harness / hidden evaluator / apply gate)
- Where does control live? (your process / framework / infra)
- What is the canonical workflow?

Corollary: docs are one evidence source. Running the baseline is another.
The mental model must match the actual system, not the documentation alone.

### SM2 — New System ≠ Old Experience

Every new system has its own execution contract. Familiar patterns are wrong priors.

Example:
- Wrong: `git clone → pip install → pytest`
- Actual: `docker pull swebench/sweb.eval.x86_64.* → conda activate testbed → pytest in /testbed`

The only way to know is to find the canonical example and run it.

### SM3 — Evaluation Semantics Before Implementation

Correct order:
1. Confirm what "passing" means in this system
2. Run one instance end-to-end via the official path
3. Confirm your output format matches the evaluator's input format
4. Only then build quality signals, gates, and optimizations

Optimizing before step 3 produces noise, not signal.

### SM4 — Unexpected Result → System Check First

Failure classification order (must be applied in this sequence):
1. Environment failure: deps missing, wrong container, wrong cwd, wrong Python
2. Harness mismatch: different evaluator than official
3. Observation failure: insufficient data to classify
4. Task failure: the patch/implementation is genuinely wrong

Only after ruling out 1–3 is a result evidence of task quality.

### SM5 — Fallback ≠ Truth

A fallback (degraded gate, apply-gate-only, skip-test-gate) preserves system liveness.
It cannot substitute for correct evaluation.

Rules:
- Fallback results must be labeled as fallback
- Fallback results must not be mixed with full-evaluation results in the same metric
- A score reported without evaluation_method is semantically undefined

---

## Eight Operational Principles (EA1–EA8)

### EA1 — True Evaluation Boundary First (SM1)
Identify: which process runs tests, in which environment, which evaluator declares pass/fail.
Is local passing equivalent to official passing?

### EA2 — No Default Run Pattern (SM2)
Never assume the familiar run pattern is correct. Find the canonical path first.

### EA3 — Evaluation Loop Before Agent Optimization (SM3)
Run one instance via the canonical path before building any quality signal.

### EA4 — Failure Layer Classification (SM4)
Every rejected result must declare its failure layer.
Missing layer = unclassified failure = EA4 violation.

**Failure layers:** `task_failure` | `environment_failure` | `harness_mismatch` | `observation_failure`

### EA5 — Fallbacks Labeled, Not Promoted (SM5)
`apply_gate_only` accepted results must carry `is_fallback: true`.
Mixed labeling (fallback + full-eval in same bucket) = EA5 violation.

### EA6 — Evaluation Method Declared
Every result and every score report must state evaluation method.
**Allowed values:** `official_harness` | `docker_pytest` | `local_pytest` | `apply_gate_only`

### EA7 — Build System Mental Model Before Coding (SM1+SM2)
Empirical before implementation: run the baseline, confirm the environment.
10 minutes here prevents multi-day detours.

### EA8 — Observation Gate Separate from Quality Gate (SM4)
- **Observation gate**: can tests execute? (container available, imports work, test file exists)
- **Quality gate**: do tests pass? (FAIL_TO_PASS now passes, no regression)

Quality gate result is undefined when observation gate is unconfirmed.
Combining them in one check = EA8 violation.

---

## Machine-Checkable Invariants

See `eval-alignment.ts` for runtime checks.

| Invariant Code | Principle | What it checks |
|----------------|-----------|----------------|
| `EVAL_MISSING_FAILURE_LAYER` | EA4 | rejected result has no failure_layer |
| `EVAL_FALLBACK_UNLABELED` | EA5 | is_fallback:true but no fallback_reason |
| `EVAL_FALLBACK_PROMOTED` | EA5 | apply_gate_only result not marked as fallback |
| `EVAL_METHOD_UNDECLARED` | EA6 | no evaluation_method on result |
| `EVAL_QUALITY_WITHOUT_OBSERVATION` | EA8 | quality gate fired without observation confirmation |

---

## Principles Check Table (for plan docs)

```markdown
## Principles Check (SM1–SM5 / EA1–EA8)

| Principle | Status | Notes |
|-----------|--------|-------|
| SM1 System execution model identified | pass/fail | |
| SM2 No default run pattern assumed | pass/fail | |
| SM3 Evaluation loop confirmed closed | pass/fail | |
| SM4 Failure layers classified | pass/fail | |
| SM5 Fallbacks labeled, not promoted | pass/fail | |
| EA4 failure_layer on all rejections | pass/fail | |
| EA5 is_fallback on all degraded accepts | pass/fail | |
| EA6 evaluation_method on all results | pass/fail | |
| EA8 observation gate separate | pass/fail | |
```

Any `fail` → stop and fix before proceeding.

---

## Relationship to Other Principles

- `SYSTEM_PRINCIPLES.md` P1 — enforcement: evaluation method must be structurally declared
- `SYSTEM_PRINCIPLES.md` P6 — isolation: environment failures must be isolated from task failures
- `EXECUTION_MODEL.md` EM7 — guard rails: evaluation loop must close before optimization
- `CLOSURE.md` R5 — observable verification: all behavior verifiable from observable outputs
