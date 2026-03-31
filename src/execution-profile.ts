// execution-profile.ts
// Unit 2.3+: Task-semantics → Execution Budget Policy
//
// Resolves the appropriate execution profile for a given TaskContext.
// This is a system-level policy decision — NOT a benchmark convenience.
//
// Principle:
//   task semantics → resource allocation strategy
//
// Profile definitions:
//   fast       — dev iteration; single run; 4000 proposer tokens
//   standard   — reliable for reasoning tasks; N=2; 4000 proposer tokens
//   exhaustive — required for design tasks; N=3; 5000 proposer tokens
//
// Derived from empirical benchmark (2026-03-31):
//   reasoning tasks: stable 100% at standard profile
//   design tasks:    avg output ≈8000 tokens; 4000 cap hits ceiling → need exhaustive
//
// This function is the single source of truth for profile selection.
// Consumers: benchmark runner, future auto-iterate loop, governed task runner.

import type { TaskContext, TaskType } from "./resolver/policy-resolver.js"

export type ExecutionProfile = "fast" | "standard" | "exhaustive"

// Tasks that require the exhaustive profile for reliable results.
// Derived from: output token usage > proposer budget at standard profile.
const EXHAUSTIVE_TASK_TYPES = new Set<TaskType>([
  "design",
  "planning",    // structurally similar to design — multi-step, high token demand
  "incident",    // high-stakes; failure model requires depth
])

/**
 * resolveExecutionProfile — determine the execution profile for a task.
 *
 * Rules (v1 — empirically derived):
 *   1. design / planning / incident → exhaustive (token-intensive tasks)
 *   2. high / critical risk → escalate: standard → exhaustive
 *   3. all other tasks → standard
 *
 * Rule 2 applies on top of rule 3 — a reasoning task at critical risk
 * still gets exhaustive.
 *
 * @param ctx  TaskContext (task_type + risk_level required)
 * @returns    ExecutionProfile — "fast" | "standard" | "exhaustive"
 */
export function resolveExecutionProfile(ctx: TaskContext): ExecutionProfile {
  // Rule 1: task type determines base profile
  const base: ExecutionProfile = EXHAUSTIVE_TASK_TYPES.has(ctx.task_type)
    ? "exhaustive"
    : "standard"

  // Rule 2: high/critical risk escalates to exhaustive regardless of task type
  if (ctx.risk_level === "high" || ctx.risk_level === "critical") {
    return "exhaustive"
  }

  return base
}

/**
 * mergeProfiles — return the "higher" of two profiles.
 *
 * Used when running multiple scenarios in a batch: the batch should run
 * at the highest profile any individual scenario requires.
 *
 * Order: fast < standard < exhaustive
 */
export function mergeProfiles(a: ExecutionProfile, b: ExecutionProfile): ExecutionProfile {
  const ORDER: Record<ExecutionProfile, number> = { fast: 0, standard: 1, exhaustive: 2 }
  return ORDER[a] >= ORDER[b] ? a : b
}
