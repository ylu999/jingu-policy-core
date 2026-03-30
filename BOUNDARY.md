# jingu-policy-core — Boundary Rules

## Hard rules

1. policy-core MUST NOT import from:
   - jingu-agent
   - jingu-trace
   - any runtime module
   - jingu-policies (or any heuristic system)

2. policy-core functions MUST be:
   - pure (same input = same output, always)
   - deterministic
   - side-effect free

3. policy-core consumes:
   - data structures only (e.g. LoopEvent objects, plain TypeScript types)
   NOT:
   - classes (Emitter, Sink, Logger)
   - runtime instances
   - filesystem / network / process

## What this repo IS

- Source of truth for all correctness definitions (invariants, principles, loop design rules)
- Pure checker: consumes event data, checks invariants, returns InvariantCheckResult
- No state, no IO, no side effects

## What this repo IS NOT

- Not an emitter (does not generate events)
- Not a runtime executor
- Not a storage layer
- Not a heuristic engine

## Dependency direction

policy-core sits at the bottom. Everything else depends on it. It depends on nothing.
Violation of this direction = architecture regression.
