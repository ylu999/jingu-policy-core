# System Model Derivation — Principles for Working with Unfamiliar Systems

**Canonical source for:** `.claude/rules/system-mental-model.md` (behavioral adapter)
**Machine-checkable file:** `src/principles/eval-alignment.ts` (runtime checks for eval-specific invariants)

**Origin:** SWE-bench incident — local import errors misclassified as patch failures because
the Docker evaluation environment was never confirmed. The root error was not evaluation-specific:
it was the general failure to derive a correct mental model of the system before modifying it.

**Scope:** Any unfamiliar system — benchmark harness, API, CI pipeline, cloud service, evaluation
framework, deployment target. The principle does not depend on the type of system.

---

## Core Gate (non-negotiable)

```
Before modifying or extending any system, you must be able to answer:

  1. WHERE does it run? (execution environment, not assumed, confirmed)
  2. HOW is success defined? (the official evaluator, not a proxy)
  3. WHAT is the canonical path? (from primary source — docs or running baseline)

If you cannot answer all three from primary sources: STOP.
Reading is not sufficient. You must derive the model.
```

**Reading ≠ Understanding ≠ Deriving a Model**

A model is derived, not read. You have a model when you can:
- Predict what will happen for a new input
- Identify what will break if one component is removed
- Explain why the official path exists (not just that it exists)

If you cannot do these, you have notes, not a model. Do not proceed.

---

## Five Principles (SM1–SM5)

### SM1 — Derive System Model from Primary Sources

Before touching any unfamiliar system:

1. Identify where the system runs (actual execution target, not your assumption)
2. Identify how success is defined (the authoritative evaluator or acceptance criterion)
3. Identify the canonical workflow (from the system's own documentation or working example)
4. Run the canonical example before writing any code

**Primary sources:** system documentation, working baseline, running examples, source code.
**Not primary sources:** your memory of similar systems, analogies to familiar patterns.

**Violation signal:** Proceeding based on what you think the system does, not what it does.

### SM2 — New System ≠ Old Experience

Every system has its own execution contract. Familiar patterns from other systems are wrong priors.

Examples of wrong pattern transfer:
- `git clone → pip install → pytest` when the system uses `docker pull → conda activate testbed → pytest in /testbed`
- `POST predictions to API` when the system uses `sb-cli submit` with specific field format
- `local test pass = official pass` when official eval runs in a separate cloud environment

**The only correct path:** Find the canonical example. Run it. Confirm it produces the expected output.

### SM3 — Evaluation Semantics Before Implementation

Build in this order:
1. Confirm what "success" means in this system (official definition, not your interpretation)
2. Run one instance end-to-end via the official path
3. Confirm your output format matches the evaluator's input format exactly
4. Only then build quality signals, optimizations, or improvements

**Violation:** Building gates, prompts, or metrics before step 3. These produce noise, not signal.

### SM4 — Unexpected Result → System Check First

When a result is unexpected, check system layers in this order:
1. Environment failure: deps missing, wrong container, wrong cwd, wrong Python
2. Harness mismatch: different evaluator than official
3. Observation failure: insufficient data to classify
4. Task failure: the implementation is genuinely wrong

Only after ruling out 1–3 is a result evidence of task quality.

**Violation:** Treating every failure as task failure (layer 4) without checking layers 1–3.

### SM5 — Fallback ≠ Truth

A fallback (degraded evaluation, proxy check, skip-gate) preserves system liveness.
It cannot substitute for authoritative evaluation.

Rules:
- Fallback results must be labeled as fallback
- Fallback results must not be mixed with full-evaluation results in the same metric
- A score reported without evaluation method is semantically undefined

---

## Evaluation-Specific Invariants (EA1–EA8)

EA1–EA8 are operational checks that enforce SM1–SM5 for benchmark/evaluation systems.
They are defined in `EVAL_ALIGNMENT.md` and machine-checked in `eval-alignment.ts`.

### EA1 — True Evaluation Boundary First (SM1)
Identify: which process runs tests, in which environment, which evaluator declares pass/fail.

### EA2 — No Default Run Pattern (SM2)
Never assume the familiar run pattern. Find the canonical path first.

### EA3 — Evaluation Loop Before Agent Optimization (SM3)
Run one instance via the canonical path before building any quality signal.

### EA4 — Failure Layer Classification (SM4)
Every rejected result must declare its failure layer. Missing layer = EA4 violation.
**Failure layers:** `task_failure` | `environment_failure` | `harness_mismatch` | `observation_failure`

### EA5 — Fallbacks Labeled, Not Promoted (SM5)
`apply_gate_only` accepted results must carry `is_fallback: true`.

### EA6 — Evaluation Method Declared
Every result must state its evaluation method.
**Allowed values:** `official_harness` | `docker_pytest` | `local_pytest` | `apply_gate_only`

### EA7 — Build System Mental Model Before Coding (SM1+SM2)
Run the baseline example before writing any code.

### EA8 — Observation Gate Separate from Quality Gate (SM4)
- **Observation gate**: can tests execute? (env correct, imports work, container available)
- **Quality gate**: do tests pass?
Quality gate result is undefined when observation gate is unconfirmed.

---

## Pre-task Checklist (8 questions, mandatory)

```
Before writing code for any benchmark or agent system:

1. How is this system launched? (Docker / venv / conda / remote sandbox / local)
2. Who provides dependencies? (pre-built image / setup script / user installs)
3. Who defines success/failure? (harness / unit test / apply-only / hidden evaluator)
4. Is local passing equivalent to official passing?
5. What is the official minimum run command? (from README "Evaluation" section)
6. What does a working baseline look like? (find one and confirm it works)
7. What gap exists between my setup and the official path?
8. Are current failures: task failures / environment failures / harness mismatches?
```

**If any question is unanswered: STOP. Find the answer before proceeding.**

---

## Principles Check Table (for plan docs)

```markdown
## Principles Check (SM1–SM5)

| Principle | Status | Notes |
|-----------|--------|-------|
| SM1 System model derived from primary sources | pass/fail | |
| SM2 No prior-system pattern assumed | pass/fail | |
| SM3 Evaluation loop confirmed closed | pass/fail | |
| SM4 Failure layers classified | pass/fail | |
| SM5 Fallbacks labeled, not promoted | pass/fail | |
```

Any `fail` → stop and fix before proceeding.

---

## Relationship to Other Principles

- `SYSTEM_PRINCIPLES.md` P1 — enforcement: evaluation method must be structurally declared
- `SYSTEM_PRINCIPLES.md` P6 — isolation: environment failures must be isolated from task failures
- `EXECUTION_MODEL.md` EM7 — guard rails: evaluation loop must close before optimization
- `EVAL_ALIGNMENT.md` — evaluation-specific operational checks (EA1–EA8)
