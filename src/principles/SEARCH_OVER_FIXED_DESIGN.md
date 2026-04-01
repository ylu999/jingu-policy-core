# Principle: Search Over a Fixed Design Space

**Short form:** Auto-loop may tune policies, but must not define them.

**One-line:** Search over a fixed design; don't search for the design itself.

---

## Statement

An optimization loop (auto-loop, search agent, parameter tuner) operates within a
**fixed design space** defined by human architects. It may search over configurations,
thresholds, and policy selections within that space. It must not redefine the space
itself — the ontology, the semantic boundaries, or the meta-rules that govern what
counts as a valid policy.

---

## Three Layers

### Layer 1 — Design Ontology (human-defined, not searchable)

The meta-rules that define what a valid policy looks like:
- What counts as evidence
- What counts as a principle violation
- What the cognition mapping types mean
- What reject reason codes are semantically distinct
- What "improvement" means (the metric definition)

**If the loop can modify this layer, it will learn to game it.**

Concrete failure mode: loop relaxes evidence requirements → acceptance rate rises →
resolve rate unchanged or drops → metric looks better but system value is degraded.
This is reward hacking at the ontology level.

### Layer 2 — Policy Space (human-scoped, loop-searchable)

The set of valid configurations within the ontology:
- Which principles are active
- Which cognition subtypes are required at each stage
- Gate strictness levels
- Retry feedback styles
- Evidence requirements per stage

The loop may search over this layer **only after the space has been explicitly defined**.
It selects combinations, not categories.

### Layer 3 — Runtime Parameters (fully loop-searchable)

Thresholds, counts, timeouts, weights:
- step_limit, max_attempts, worker count
- Gate rejection thresholds
- Scoring weights for candidate selection
- Probe budget before diagnosis

This is the loop's primary search domain.

---

## Principle Evolution Workflow

Principles may evolve, but through a governed two-loop process:

**Loop A — Optimization loop** (automated)
1. Run experiments within fixed design space
2. Collect resolve/reject/retry outcomes
3. Cluster failure patterns
4. Surface: "existing principles don't cover this pattern"

**Loop B — Governance evolution loop** (human-led, loop-assisted)
1. Loop A produces failure evidence and candidate gaps
2. Human reviews: is this a real principle gap or a parameter issue?
3. If real gap: human drafts candidate principle
4. Candidate enters next experiment as a new Layer 2 option
5. If validated across multiple runs: promoted to Layer 1

The loop provides evidence. Humans decide what becomes a principle.

---

## Why This Matters

Without this separation:
- Loop optimizes toward metric, not toward system value
- Principles drift toward whatever makes the metric easier
- The system looks better on the benchmark but is less trustworthy
- You cannot explain *why* a configuration works

With this separation:
- Loop results are interpretable (which policy helped?)
- Principles are stable reference points
- Regressions are detectable (did the design space shrink?)
- System value is preserved even as configurations evolve

---

## Application to jingu-swebench

| Layer | Who controls | Examples |
|-------|-------------|---------|
| Ontology | Human architect | "what counts as patch admission", reject reason semantics |
| Policy space | Human-scoped, loop searches | which gate rules active, strictness level |
| Runtime params | Loop | step_limit, max_attempts, retry hint text |

The B0→B1→B2→B3 experiment sequence is a Layer 1 decision.
Within each B-stage, the loop tunes Layer 2 and Layer 3.
The loop must not collapse B1 back toward B0 by disabling the trust-gate to improve scores.

---

## Violation Signals

- Loop disabled a gate constraint and scores improved → reward hacking
- Loop changed the metric definition → ontology violation
- Loop merged two semantically distinct reject codes → ontology violation
- Loop "optimized" a principle into a no-op → ontology violation
- Scores improved but no Jingu feature is meaningfully active → B0 masquerading as B1+
