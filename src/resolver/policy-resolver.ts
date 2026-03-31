// policy-resolver.ts
// Unit 0.1: PolicyResolver
//
// Takes a TaskContext and returns an ExecutionConfig describing which
// constraints, gates, and reviewer mode apply for that execution.
// No LLM calls. No I/O. Pure function.

export type TaskType =
  | "problem_framing"
  | "reasoning"
  | "design"
  | "execution"
  | "verification"
  | "planning"
  | "communication"
  | "learning"
  | "debugging"
  | "incident"

export type RiskLevel = "low" | "medium" | "high" | "critical"

export type ExecutionMode = "single" | "parallel" | "proposal_reviewer"

export type ReviewerMode = "none" | "optional" | "required"

export interface TaskContext {
  task_type: TaskType
  risk_level: RiskLevel
  execution_mode?: ExecutionMode
  is_irreversible?: boolean
  crosses_module_boundary?: boolean
}

export interface PolicyPack {
  id: string
  policies: string[]
  gates: string[]
  reviewer_checks: string[]
}

export interface ExecutionConfig {
  active_packs: PolicyPack[]
  required_gates: string[]
  reviewer_mode: ReviewerMode
  execution_mode: ExecutionMode
}

// ---------------------------------------------------------------------------
// Pack definitions (static — Phase 0)
// ---------------------------------------------------------------------------

const GLOBAL_PACK: PolicyPack = {
  id: "global",
  policies: [
    "no_assumption_as_fact",
    "evidence_required_for_claims",
    "uncertainty_must_be_explicit",
  ],
  gates: [
    "evidence_required_gate",
    "verify_gate",
    "no_op_detection_gate",
  ],
  reviewer_checks: [],
}

const POLICY_PACKS: Record<TaskType, PolicyPack> = {
  problem_framing: {
    id: "problem_framing",
    policies: [
      "must_define_problem_statement",
      "must_define_success_criteria",
      "must_state_scope_and_nongoals",
      "must_not_solution_before_problem",
    ],
    gates: ["problem_statement_gate", "success_criteria_gate"],
    reviewer_checks: [],
  },
  reasoning: {
    id: "reasoning",
    policies: [
      "must_provide_at_least_2_options",
      "must_separate_facts_assumptions_unknowns",
      "conclusions_must_cite_evidence",
      "must_include_why_not_for_rejected",
    ],
    gates: ["rpp_intent_gate", "rpp_tradeoff_gate", "evidence_gate"],
    reviewer_checks: ["counterexample_check"],
  },
  design: {
    id: "design",
    policies: [
      "must_include_failure_model",
      "must_define_module_boundaries",
      "must_include_rollout_plan",
      "must_include_risks",
    ],
    gates: ["design_completeness_gate", "rpp_risk_gate", "scope_gate"],
    reviewer_checks: ["design_review_check"],
  },
  execution: {
    id: "execution",
    policies: [
      "must_not_exceed_allowed_file_scope",
      "must_have_verify_plan_before_execute",
      "changes_must_be_reversible_or_have_rollback",
    ],
    gates: ["file_scope_gate", "verify_plan_gate"],
    reviewer_checks: [],
  },
  verification: {
    id: "verification",
    policies: [
      "every_claim_must_be_verifiable",
      "state_must_not_advance_without_verify",
      "must_separate_observation_from_hypothesis",
    ],
    gates: ["verify_gate", "evidence_gate"],
    reviewer_checks: [],
  },
  planning: {
    id: "planning",
    policies: [
      "must_include_dependencies",
      "must_include_sequencing",
      "must_assign_owners_or_roles",
    ],
    gates: ["dependency_gate", "circular_dependency_gate"],
    reviewer_checks: [],
  },
  communication: {
    id: "communication",
    policies: [
      "must_structure_output_for_audience",
      "decision_must_include_rationale",
    ],
    gates: ["key_decision_gate"],
    reviewer_checks: [],
  },
  learning: {
    id: "learning",
    policies: [
      "failures_must_be_typed",
      "must_identify_root_cause_class",
      "must_propose_future_guardrail",
    ],
    gates: ["failure_classification_gate"],
    reviewer_checks: [],
  },
  debugging: {
    id: "debugging",
    policies: [
      "must_separate_observation_hypothesis_proof",
      "must_include_reproduction_steps",
      "must_include_regression_prevention",
    ],
    gates: ["reproduction_gate", "root_cause_gate", "test_pass_gate"],
    reviewer_checks: [],
  },
  incident: {
    id: "incident",
    policies: [
      "must_timeline_events",
      "must_identify_root_cause",
      "must_propose_guardrail",
    ],
    gates: ["root_cause_gate", "guardrail_gate"],
    reviewer_checks: [],
  },
}

const HIGH_RISK_PACK: PolicyPack = {
  id: "high_risk",
  policies: [
    "reviewer_required",
    "rollback_plan_mandatory",
    "multi_option_required",
  ],
  gates: ["rollback_gate"],
  reviewer_checks: ["pre_mortem_check", "scope_check"],
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

// Derived from POLICY_PACKS keys — single source of truth, no separate maintenance
const VALID_TASK_TYPES = new Set<string>(Object.keys(POLICY_PACKS))

const VALID_RISK_LEVELS = new Set<string>(["low", "medium", "high", "critical"])

export function resolvePolicies(ctx: TaskContext): ExecutionConfig {
  if (!VALID_TASK_TYPES.has(ctx.task_type)) {
    throw new Error(`unknown task_type: ${ctx.task_type}`)
  }
  if (!VALID_RISK_LEVELS.has(ctx.risk_level)) {
    throw new Error(`unknown risk_level: ${ctx.risk_level}`)
  }

  // Shallow-copy each pack so callers cannot mutate global constants
  const packs: PolicyPack[] = [
    { ...GLOBAL_PACK },
    { ...POLICY_PACKS[ctx.task_type] },
  ]

  if (ctx.risk_level === "high" || ctx.risk_level === "critical") {
    packs.push({ ...HIGH_RISK_PACK })
  }

  // Flat deduplicated gate list — order: global first, task-type second, risk last.
  // gatesSeen is built here and intentionally reused for flag dedup below.
  const gatesSeen = new Set<string>()
  const required_gates: string[] = []
  for (const pack of packs) {
    for (const gate of pack.gates) {
      if (!gatesSeen.has(gate)) {
        gatesSeen.add(gate)
        required_gates.push(gate)
      }
    }
  }

  // Flag-driven gates — must run after pack traversal so gatesSeen reflects all pack gates
  if (ctx.is_irreversible && !gatesSeen.has("rollback_gate")) {
    required_gates.push("rollback_gate")
  }
  if (ctx.crosses_module_boundary && !gatesSeen.has("scope_gate")) {
    required_gates.push("scope_gate")
  }

  // Reviewer mode: critical → required; high or pack has reviewer_checks → optional; else none
  const hasReviewerChecks = packs.some(p => p.reviewer_checks.length > 0)
  let reviewer_mode: ReviewerMode
  if (ctx.risk_level === "critical") {
    reviewer_mode = "required"
  } else if (ctx.risk_level === "high" || hasReviewerChecks) {
    reviewer_mode = "optional"
  } else {
    reviewer_mode = "none"
  }

  return {
    active_packs: packs,
    required_gates,
    reviewer_mode,
    execution_mode: ctx.execution_mode ?? "single",
  }
}
