// execution-profile.ts
// Unit 2.3+: Task-semantics → Execution Budget Policy
//
// Resolves the appropriate execution profile for a given TaskContext.
// This is a system-level policy decision — NOT a benchmark convenience.
//
// Principle:
//   task semantics → resource allocation strategy
//
// Profile definitions (4-tier taxonomy — v2, empirically derived 2026-03-31):
//   fast           — dev iteration; single run; 4000 proposer tokens
//   standard       — reliable for reasoning tasks; N=2; 4000 proposer tokens
//   exhaustive     — required for design tasks; N=3; 5000 proposer tokens
//   deep_exhaustive — required for heavy design tasks; N=3; 8000 proposer tokens
//
// Derived from empirical benchmark (2026-03-31):
//   reasoning tasks:           stable 100% at standard profile
//   ambiguous design tasks:    exhaustive sufficient (S4: improved from standard)
//   heavy design tasks:        avg output ≈6500–8000 tokens; 5000 cap still hits ceiling → need deep_exhaustive
//
// Two orthogonal dimensions:
//   risk_level:       decision danger  → controls reviewer mode (policy-resolver)
//   complexity_class: output complexity → controls token budget (this file)
//
// This function is the single source of truth for profile selection.
// Consumers: benchmark runner, future auto-iterate loop, governed task runner.

import type { TaskContext, TaskType } from "./resolver/policy-resolver.js"

export type ExecutionProfile = "fast" | "standard" | "exhaustive" | "deep_exhaustive"

// Tasks that require at least exhaustive profile for reliable results.
// Derived from: output token usage > proposer budget at standard profile.
const EXHAUSTIVE_TASK_TYPES = new Set<TaskType>([
  "design",
  "planning",    // structurally similar to design — multi-step, high token demand
  "incident",    // high-stakes; failure model requires depth
])

/**
 * resolveExecutionProfile — determine the execution profile for a task.
 *
 * Rules (v2 — empirically derived 2026-03-31):
 *   1. design / planning / incident + complexity_class="heavy" → deep_exhaustive
 *   2. design / planning / incident (default)                  → exhaustive
 *   3. high / critical risk → escalate: standard → deep_exhaustive
 *   4. all other tasks → standard
 *
 * Rule 3 applies on top of rule 4 — a reasoning task at critical risk
 * still gets deep_exhaustive (high-stakes decisions need maximum budget).
 *
 * complexity_class and risk_level are orthogonal:
 *   complexity_class = output complexity (token budget)
 *   risk_level       = decision danger   (reviewer mode, in policy-resolver)
 *
 * @param ctx  TaskContext (task_type + risk_level required; complexity_class optional)
 * @returns    ExecutionProfile — "fast" | "standard" | "exhaustive" | "deep_exhaustive"
 */
export function resolveExecutionProfile(ctx: TaskContext): ExecutionProfile {
  // Rule 1 + 2: task type determines base profile; complexity_class elevates within exhaustive tier
  const base: ExecutionProfile = EXHAUSTIVE_TASK_TYPES.has(ctx.task_type)
    ? (ctx.complexity_class === "heavy" ? "deep_exhaustive" : "exhaustive")
    : "standard"

  // Rule 3: high/critical risk escalates to deep_exhaustive regardless of task type or base profile.
  // Applies on top of rule 1+2 — a design task at high risk also gets deep_exhaustive.
  if (ctx.risk_level === "high" || ctx.risk_level === "critical") {
    return "deep_exhaustive"
  }

  return base
}

/**
 * mergeProfiles — return the "higher" of two profiles.
 *
 * Used when running multiple scenarios in a batch: the batch should run
 * at the highest profile any individual scenario requires.
 *
 * Order: fast < standard < exhaustive < deep_exhaustive
 */
export function mergeProfiles(a: ExecutionProfile, b: ExecutionProfile): ExecutionProfile {
  const ORDER: Record<ExecutionProfile, number> = {
    fast: 0, standard: 1, exhaustive: 2, deep_exhaustive: 3,
  }
  return ORDER[a] >= ORDER[b] ? a : b
}
