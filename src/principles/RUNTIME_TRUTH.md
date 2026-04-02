# Runtime Truth First — Canonical Principle Definition

**Consumer:** `.claude/rules/runtime-truth.md` (behavioral guide for Claude)
**Machine-checkable counterpart:** `runtime-truth.ts`

---

## Statement

In artifact-based systems (ECS, Docker, remote runners), only the deployed,
observable, versioned artifact is the source of truth.

Source code in a local working tree, a git commit, or a plan document is a proposal —
not evidence that a behavior is live in the running system.

---

## The Eight Rules (RT1–RT8)

### RT1 — Verify Execution Identity Before Analyzing Behavior

Every result analysis must be preceded by execution identity verification:
- Image digest of the running task
- Git commit that produced the image
- Confirmation the commit contains the change under test

**Invariant:** `RT_IDENTITY_NOT_VERIFIED` — result analyzed without identity check

### RT2 — Absence of Signal Must Be Typed

Signal absence has multiple distinct causes:
1. `deployment_failure` — image not rebuilt after relevant commit
2. `wiring_failure` — component loaded but not connected
3. `model_behavior` — model received correct prompt, did not follow it
4. `parser_failure` — output present but extractor dropped it

These must be classified before any behavioral conclusion is drawn.

**Invariant:** `RT_UNTYPED_ABSENCE` — absence attributed to behavior without ruling out deployment/wiring

### RT3 — Never Attribute to Model What Could Be Wiring

Debugging order is mandatory:
1. deployment failure? (identity check)
2. wiring failure? (activation proof)
3. observability failure? (parser/extractor check)
4. model behavior? (only after 1–3 are ruled out)

**Invariant:** `RT_MODEL_BLAMED_BEFORE_WIRING_CLEARED`

### RT4 — Every Critical Feature Must Emit Activation Proof

Control-plane features (gates, prompt injection, policy bundles) must log activation:
```
feature_name=<name>
feature_enabled=true
version=<hash or semver>
```

Absence of these signals means the feature's status is unknown — not "enabled."

**Invariant:** `RT_MISSING_ACTIVATION_PROOF`

### RT5 — No Large-Scale Experiment Without Smoke Test

A smoke test on 1 instance with the new image must pass before a multi-instance batch.
The smoke test must verify the expected new behavior is present in the traj.

**Invariant:** `RT_BATCH_WITHOUT_SMOKE_TEST`

### RT6 — Run Artifacts Must Carry Their Own Provenance

Every run_report, traj, and prediction output must include:
- `image_digest`
- `git_commit`
- `build_timestamp`

**Invariant:** `RT_ARTIFACT_MISSING_PROVENANCE`

### RT7 — Commit ≠ Deployed

A commit proves code was written. The deployment chain is:
`commit → build → push → task-def → pull → run`

Each step must be verified independently.

**Invariant:** `RT_COMMIT_TREATED_AS_DEPLOYED`

### RT8 — Local Code Is Not the System

When diagnosing unexpected behavior, check the deployed artifact first.
Do not read local source code to explain remote runtime behavior.

---

## Relationship to Other Principles

| Principle | Relationship |
|-----------|-------------|
| SM4 (System Mental Model) | RT3 is the deployment layer of SM4's debugging order |
| EFR (Execution Feedback Required) | EFR requires correct execution — RT1 is the precondition |
| EA4 (Classify Failure Layers) | RT2 adds deployment_failure and wiring_failure as distinct layers |
| EA7 (Build System Mental Model Before Coding) | RT5 (smoke test) is the operational enforcement of EA7 |
