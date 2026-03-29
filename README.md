# jingu-policy-core

Engineering discipline policy library for [Jingu](https://github.com/ylu999/jingu-core).

Defines what correct agent reasoning looks like. Does not enforce it — that is [trust-gate](https://github.com/ylu999/jingu-trust-gate)'s job.

```
policy-core answers: does this reasoning satisfy the rules?
trust-gate answers:  should this proposal be allowed to execute?
```

## What this is

A pure TypeScript library of **19 policies** (P1–P19) that evaluate agent proposals for engineering discipline violations — constraint obedience, precondition checking, claim honesty, reasoning coherence, and more.

Zero runtime dependencies. No I/O. No side effects. Same input → same output.

## Installation

```bash
npm install @jingu/policy-core
```

## Quick start

```typescript
import { evaluateV4 } from "@jingu/policy-core"
import type { Input } from "@jingu/policy-core"

const input: Input = {
  task: {
    objective: "Deploy ECS service",
    constraints: { requiredTools: ["terraform"] },
  },
  proposal: {
    summary: "Use AWS CLI directly since terraform is unavailable",
    plannedActions: [
      { type: "command", command: "aws ecs create-cluster", intent: "bypass terraform" },
    ],
  },
  reasoningFrame: {
    coreTension: "terraform_only constraint vs terraform unavailability",
    problemLayer: "environment",
    symptoms: ["terraform binary not found in PATH"],
    hypotheses: ["terraform dependency missing — not installed via package manager"],
    verifiedFacts: ["which terraform: not found"],
    tradeoffs: ["fix env vs bypass constraint — fix env is the only compliant path"],
    proposedIntervention: "Install terraform via tfenv before proceeding",
    nextStep: "Install terraform via tfenv and verify PATH",
  },
}

const result = evaluateV4(input)
// result.decision: "accept" | "reject" | "block"
// result.score: 0–100
// result.grade: "A" | "B" | "C" | "D" | "F"
// result.violations: Violation[]
```

## Policy overview

### Discipline (P1–P9)
| ID | Name | What it catches |
|----|------|-----------------|
| P1 | Constraint Obedience | Actions that violate explicit task constraints |
| P2 | Preconditions | Proceeding without analyzing failure signals |
| P3 | Blind Retry | Retrying the same failure without diagnosis |
| P4 | Scope Escape | Mutating files outside allowed scope |
| P5 | Underdefined Plan | Proposals with no actions or missing intent |
| P6 | Unverified Mutation | Write actions without supporting evidence |
| P7 | Hygiene | Committing large files or generated artifacts |
| P8 | Claim Honesty | Claims unsupported by evidence |
| P9 | Hypothesis Search | Search/read actions without a stated hypothesis |

### Senior (P10–P19)
| ID | Name | What it catches |
|----|------|-----------------|
| P10 | Core Tension | Missing articulation of the constraint conflict |
| P11 | Layer Diagnosis | Unidentified problem abstraction layer |
| P12 | No Hypotheses | Acting without forming a hypothesis |
| P13 | No Tradeoffs | No explicit options comparison |
| P14 | No Intervention | No clearly stated fix |
| P15 | Recurrence Prevention | No plan to prevent the same failure |
| P16 | Externalize Context | Acting without externalizing working state |
| P17 | Externalize on Discovery | New findings not recorded as discoveries |
| P18 | Blocker Precedence | Active blockers not prioritized |
| P19 | Context Budget | Proposal exceeds execution scope budget |

## Evaluation pipeline

```
Input
  │
  ▼
enforceReasoningFrame()   ← must pass before any policy runs
  │                          requires: coreTension, layer, hypotheses,
  │                                    tradeoffs, intervention, nextStep
  ▼
checkReasoningCoherence() ← validates causal chain
  │                          symptoms → hypothesis (mechanism) → intervention
  ▼
P1–P9  (discipline score)
P10–P19 (seniority score)
  │
  ▼
overallScore = discipline × 0.6 + seniority × 0.4
grade        = A/B/C/D/F
decision     = accept / reject / block
```

### V5: optional LLM semantic judge

```typescript
import { evaluateV5WithJudgement } from "@jingu/policy-core"
import type { RichCoherenceJudge } from "@jingu/policy-core"

// Provide your own LLM-backed judge (e.g. from jingu-agent)
const result = await evaluateV5WithJudgement(input, myLLMJudge)
```

`evaluateV5` adds a third layer: an optional LLM judge that semantically validates the causal chain `symptom → hypothesis → intervention`. Callers without a judge get identical behavior to `evaluateV4`.

## Typed claims (v1)

Policy-core supports typed evidence and claims for machine-checkable constraints:

```typescript
const input: Input = {
  // ...
  evidence: {
    items: [
      { id: "ev-1", type: "command_output", value: "which terraform: not found" },
    ],
  },
  claim: {
    statements: ["terraform is not installed"],
    typed: [
      {
        id: "cl-1",
        type: "diagnosis",
        text: "terraform dependency missing",
        evidenceRefs: ["ev-1"],  // must reference existing evidence IDs
      },
    ],
  },
}
```

P8 (Claim Honesty) enforces: `∀ typed claim → claim.evidenceRefs ⊆ evidence.items[].id`

## RPP — Reasoning Provenance Protocol

Per-call cognitive audit contract. Every reasoning step must be traceable to evidence, rules, or methods.

```typescript
import { validateRPP } from "@jingu/policy-core"
import type { RPPRecord } from "@jingu/policy-core"

const result = validateRPP(record)
// result.overall_status: "valid" | "weakly_supported" | "invalid"
```

## Architecture

```
jingu-core  ←  jingu-agent      (LLM intelligence — private)
jingu-core  ←  jingu-policy-core  ← you are here
jingu-core  ←  trust-gate       (enforcement layer — uses policy-core)
```

**Dependency direction**: `trust-gate → policy-core → (nothing)`.
Policy-core has no knowledge of enforcement, execution, or runtime layers.

## Development

```bash
npm install
npm run build   # tsc
npm test        # node --test dist/**/*.test.js
```

## License

MIT