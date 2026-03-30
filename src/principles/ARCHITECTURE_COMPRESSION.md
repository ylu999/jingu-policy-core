# Architecture Compression — Canonical Principles

**Scope:** System-level architectural evolution rules. Apply during consolidation phases, post-exploration, before expansion.

**Relationship to other principles:**
- P6 (Separate Orthogonal Concerns) — operates at module level; these operate at layer/repo level
- EM7 (Guard Rails Before Execution) — guard rails must exist before compression begins
- CLOSURE.md — compression must preserve or improve closure level

---

## The Architecture Compression Cycle

Systems evolve through three phases. Each requires different actions.

```
Exploration → Consolidation → Expansion
   (add)         (compress)      (add)
```

**Exploration:** Add capabilities quickly. Accept redundancy. Accept peripheral modules. Goal: find what works.

**Consolidation (Compression):** Delete what exploration revealed as peripheral. Harden what exploration revealed as core. Goal: reduce to minimum viable execution path.

**Expansion:** Add new capabilities on top of hardened core. No more exploration debt.

**Compression is not cleanup.** It is a structural phase transition. The exit condition is not "code looks tidier" — it is "the execution core is identified, isolated, and protected."

---

## P1 — Separation of Concerns at Layer Level

**Statement:** Each architectural layer must have exactly one responsibility class. A layer that governs must not decide. A layer that decides must not execute. A layer that executes must not observe.

**Why:** Cross-layer responsibility creates invisible coupling. When a governance layer also contains decision heuristics, removing the heuristics requires reasoning about governance impact. Layers must be deletable independently.

**Correct design:**
- `jingu-agent` = governance orchestration (propose → bind → review → verdict)
- `jingu-policies` = decision logic (task selection, priority, gap detection)
- `jingu-trace` = observability (event emission, trace comparison)
- No layer imports from a layer of the same type

**Violation signals:**
- Governance layer contains task selection heuristics
- Decision layer emits observability events directly
- Execution layer contains retry policy logic

---

## P2 — Single Responsibility per Layer

**Statement:** A layer's responsibility must be stateable in one sentence. If two sentences are required, the layer has two responsibilities and must be split.

**Why:** A layer with two responsibilities cannot be correctly maintained, tested, or replaced. When a bug occurs, the two responsibilities generate conflicting pressures on the fix.

**One-sentence test (jingu-agent):**
- PASS: "Connect LLM providers to the governance loop."
- FAIL: "Connect LLM providers to the governance loop, and select the next task to execute."

**Correct design:**
- Define the one-sentence responsibility before writing any code
- Any new feature request that requires adding a second sentence → belongs in a different layer
- The BOUNDARY.md file enforces this: it lists what the layer IS and IS NOT responsible for

**Violation signals:**
- No BOUNDARY.md or equivalent single-responsibility declaration
- BOUNDARY.md "IS responsible for" section has more than one distinct concern
- Adding a feature requires importing from a module in the "NOT responsible for" list

---

## P3 — Core vs Peripheral Isolation

**Statement:** The execution core (minimum path from input to governance verdict) must be identifiable as a set of modules with zero dependencies on peripheral modules.

**Why:** Peripheral modules accumulate exploration debt. When consolidation is needed, peripheral modules must be deletable without modifying core modules. If core imports peripheral, deletion requires core modification — amplifying risk.

**Classification rules:**
- **Core:** Required for every governance decision. Zero-dependency replacement is impossible.
- **Peripheral:** Enhances or observes core behavior. Core functions without it.

**jingu-agent core (post-compression):**
```
governance/loop.ts → governance/runner.ts → governance/reviewer.ts
llm/client.ts (interface only)
prompts/review/ (reviewer prompts)
```

**jingu-agent peripheral (deleted in compression):**
```
decision/ — task heuristics (belongs in jingu-policies)
benchmark/ — harness (not governance)
coherence/ — trust-gate era (superseded)
rpp/ — session audit (separate concern)
```

**Correct design:**
- Core modules must have zero imports from peripheral modules
- `check:boundary` enforces this structurally
- Peripheral modules may import core; core must never import peripheral

**Violation signals:**
- `governance/loop.ts` imports from `decision/`
- Core test count decreases when a "peripheral" module is deleted (it wasn't peripheral)
- `check:boundary` passes but core behavior changes when peripheral is removed

---

## P4 — Architecture Before Optimization

**Statement:** The layer structure must be correct before adding optimization mechanisms. An optimization built on wrong structure optimizes the wrong thing.

**Why:** Optimization is path-dependent. An LLM decision heuristic built inside a governance layer optimizes governance throughput, not decision quality. Moving it later requires redesigning both layers.

**Consolidation gate (required before Expansion):**
1. All layers have single-sentence responsibilities (P2)
2. Core is isolated from peripheral (P3)
3. Layer boundaries enforced by CI (P1 + CLOSURE R3)
4. Closure level is L5 (all rules pass)

Only after this gate: add new capabilities.

**Anti-pattern:** "We'll refactor the layer structure after adding the next feature."
This is EM7 violation: adding features before guard rails are in place.

---

## Compression Identification Criteria

How to recognize when a system needs compression (consolidation phase):

1. **Responsibility diffusion:** More than one layer can answer "who handles X?"
2. **Import ambiguity:** A core module imports from a module that "should be" in another layer
3. **Test fragility:** Deleting one module causes unrelated tests to fail
4. **Boundary document missing or stale:** BOUNDARY.md hasn't been updated in the last major feature cycle

---

## Compression Execution Protocol

When compression is warranted:

1. **Map the core.** List all modules required for the minimum governance path.
2. **Classify peripherals.** For each non-core module: which other layer owns this concern?
3. **Audit imports.** Confirm core has zero imports from peripheral (`grep` or `check:boundary`).
4. **Delete safely.** Remove peripheral modules. Run `check:closure` after each deletion.
5. **Write BOUNDARY.md.** Declare the new single-sentence responsibility.
6. **Record in journal.** Compression is a phase transition — it must be documented.

**Exit condition:** `check:closure` → `CLOSURE: PASS (L5)` after all deletions.

---

## Maturity Progression

Architecture maturity follows compression cycles:

```
L5-alpha    First L5 achieved, many peripheral modules still present
L5-stable   Peripheral modules removed, core isolated
L5-hardened Closure drift detection active, baseline governed
L5-governed Semantic validation of baseline changes
```

Each level is a stable plateau, not a checkpoint to rush through.
Advancing without satisfying the current level's criteria produces brittle systems.
