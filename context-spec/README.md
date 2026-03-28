# Jingu Context Artifacts

## P16 — Externalize Working Context

> "Memory is not state."

Every Jingu-governed task must maintain durable working context.
This context is not documentation — it is the live working state of the agent.

## Required Structure

```
.jingu/
├── context/
│   └── active-task.md     ← live working state (update before/after each action)
├── decisions/
│   └── <task-id>.md       ← key decision records (why block, why reject, why choose this path)
└── evidence/
    └── <run-id>.json      ← verification artifacts, logs, diff summaries
```

## When to Update active-task.md

Mandatory update points (P16 enforces these):

1. **Task start** — before first proposal
2. **Before any write/command action** — context must be current
3. **After failure** — update symptoms, hypotheses, next step
4. **Before retry** — must show what changed vs last attempt
5. **Before completion claim** — final state + evidence refs

## What to Write

Minimum required fields:
- `Task`: what we're doing
- `Core Tension`: the main constraint conflict
- `Known Facts`: verified observations
- `Active Hypotheses`: current working theory
- `Next Step`: single next action

## Why This Matters

Without durable context:
- Retries are blind
- Claims float free of evidence
- Handoffs fail
- Session restarts lose all progress
- Reviews have nothing to audit

With durable context:
- Any agent (or human) can pick up where work left off
- Decisions are traceable
- Failures are classifiable
- Claims are grounded
