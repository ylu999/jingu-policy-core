/**
 * taxonomy.ts — CDP v1 Taxonomy
 *
 * Canonical type/subtype/principal contract for the Cognition Declaration Protocol.
 * This is the machine-consumable source of truth for p171+ validators and p174 gate.
 *
 * Rules:
 * - 9 types, mutually exclusive at declaration time
 * - 12 principal atoms, shared across all types
 * - Each type has: requiredPrincipals (must declare ≥1), optionalPrincipals, forbiddenPrincipals
 * - subTypes are refinements of the parent type — they inherit the type's principal requirements
 * - TYPE_TO_VALIDATORS: strong binding — runs even if LLM omits the principal
 */

// ── Principal atoms (12) ──────────────────────────────────────────────────────

export type Principal =
  | "evidence_based"        // claims must be grounded in evidence
  | "no_hallucination"      // no unsupported content
  | "constraint_awareness"  // respect task/system constraints
  | "scope_control"         // no out-of-scope operations
  | "consistency_check"     // internal logical consistency
  | "execution_first"       // validate through execution
  | "minimal_change"        // minimize change surface
  | "causality"             // causal inference (semi-hard)
  | "hypothesis_testing"    // hypothesis→verify flow (semi-hard)
  | "completeness"          // cover all required dimensions (semi-hard)
  | "risk_awareness"        // signal only — qualitative
  | "explicit_assumption"   // signal/partial — assumptions stated

export const ALL_PRINCIPALS: Principal[] = [
  "evidence_based",
  "no_hallucination",
  "constraint_awareness",
  "scope_control",
  "consistency_check",
  "execution_first",
  "minimal_change",
  "causality",
  "hypothesis_testing",
  "completeness",
  "risk_awareness",
  "explicit_assumption",
]

// ── Validator names (referenced by TYPE_TO_VALIDATORS) ───────────────────────

export type ValidatorName =
  | "evidence_coverage"
  | "no_unsupported_claim"
  | "constraint_check"
  | "scope_check"
  | "consistency_check"
  | "execution_check"
  | "diff_size_check"
  | "causal_link_check"
  | "coverage_check"
  | "hypothesis_flow_check"
  | "assumption_present_check"

// ── TypePolicy ────────────────────────────────────────────────────────────────

export interface TypePolicy {
  /** The canonical type name */
  type: string
  /** Valid subtypes — refinements of this type, inheriting type-level requirements */
  subTypes: string[]
  /**
   * LLM must declare at least one of these principals.
   * Declaration of NONE from this list is a validation error.
   */
  requiredPrincipals: Principal[]
  /** Valid but not required — may be declared without triggering an error */
  optionalPrincipals?: Principal[]
  /** Declaring any of these alongside this type is a contradiction */
  forbiddenPrincipals?: Principal[]
  /**
   * Validators that always run for this type, regardless of principal declaration.
   * This is the safety layer: type-level enforcement bypasses LLM omission.
   */
  typeValidators: ValidatorName[]
}

// ── TYPE_POLICIES (9 types) ───────────────────────────────────────────────────

export const TYPE_POLICIES: Record<string, TypePolicy> = {
  understanding: {
    type: "understanding",
    subTypes: [
      "intent_extraction",
      "requirement_structuring",
      "constraint_identification",
    ],
    requiredPrincipals: ["constraint_awareness", "explicit_assumption"],
    optionalPrincipals: ["completeness", "risk_awareness"],
    forbiddenPrincipals: ["execution_first", "minimal_change"],
    typeValidators: ["constraint_check"],
  },

  observation: {
    type: "observation",
    subTypes: [
      "log_reading",
      "metric_reading",
      "code_inspection",
      "data_inspection",
    ],
    requiredPrincipals: ["evidence_based", "no_hallucination"],
    optionalPrincipals: ["hypothesis_testing", "explicit_assumption"],
    forbiddenPrincipals: ["minimal_change", "scope_control"],
    typeValidators: ["evidence_coverage", "no_unsupported_claim"],
  },

  analysis: {
    type: "analysis",
    subTypes: [
      "root_cause_analysis",
      "pattern_identification",
      "hypothesis_generation",
      "tradeoff_analysis",
    ],
    requiredPrincipals: ["causality"],
    optionalPrincipals: [
      "evidence_based",
      "hypothesis_testing",
      "consistency_check",
      "explicit_assumption",
    ],
    forbiddenPrincipals: ["execution_first", "scope_control"],
    typeValidators: ["consistency_check"],
  },

  diagnosis: {
    type: "diagnosis",
    subTypes: ["bug_localization", "fault_isolation"],
    requiredPrincipals: ["evidence_based", "causality"],
    optionalPrincipals: ["hypothesis_testing", "consistency_check"],
    forbiddenPrincipals: ["minimal_change"],
    typeValidators: ["evidence_coverage", "no_unsupported_claim", "causal_link_check"],
  },

  decision: {
    type: "decision",
    subTypes: ["option_selection", "strategy_choice"],
    requiredPrincipals: ["constraint_awareness"],
    optionalPrincipals: [
      "risk_awareness",
      "explicit_assumption",
      "completeness",
    ],
    forbiddenPrincipals: ["execution_first"],
    typeValidators: ["constraint_check"],
  },

  design: {
    type: "design",
    subTypes: [
      "solution_design",
      "refactor_plan",
      "architecture_design",
    ],
    requiredPrincipals: ["constraint_awareness", "completeness"],
    optionalPrincipals: [
      "risk_awareness",
      "explicit_assumption",
      "consistency_check",
      "minimal_change",
    ],
    forbiddenPrincipals: ["execution_first"],
    typeValidators: ["constraint_check", "coverage_check"],
  },

  planning: {
    type: "planning",
    subTypes: ["task_decomposition", "execution_plan"],
    requiredPrincipals: ["completeness", "consistency_check"],
    optionalPrincipals: [
      "risk_awareness",
      "explicit_assumption",
      "constraint_awareness",
    ],
    forbiddenPrincipals: ["execution_first", "minimal_change"],
    typeValidators: ["coverage_check", "consistency_check"],
  },

  execution: {
    type: "execution",
    subTypes: ["code_change", "config_change", "command_execution"],
    requiredPrincipals: ["scope_control", "minimal_change"],
    optionalPrincipals: [
      "execution_first",
      "consistency_check",
      "risk_awareness",
    ],
    forbiddenPrincipals: ["hypothesis_testing", "causality"],
    typeValidators: ["scope_check", "execution_check", "diff_size_check"],
  },

  validation: {
    type: "validation",
    subTypes: [
      "test_verification",
      "result_check",
      "consistency_validation",
    ],
    requiredPrincipals: ["execution_first", "consistency_check"],
    optionalPrincipals: [
      "evidence_based",
      "completeness",
      "no_hallucination",
    ],
    forbiddenPrincipals: ["causality", "hypothesis_testing"],
    typeValidators: ["execution_check", "consistency_check"],
  },
}

export const ALL_TYPES = Object.keys(TYPE_POLICIES)

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/** Returns the TypePolicy for a given type, or undefined if unknown */
export function getTypePolicy(type: string): TypePolicy | undefined {
  return TYPE_POLICIES[type]
}

/** Returns true if the principal is a valid Principal atom */
export function isValidPrincipal(p: string): p is Principal {
  return ALL_PRINCIPALS.includes(p as Principal)
}

/** Returns true if the subtype belongs to the given type */
export function isValidSubType(type: string, subType: string): boolean {
  return TYPE_POLICIES[type]?.subTypes.includes(subType) ?? false
}

/**
 * Returns all validator names that must run for a given type.
 * These run regardless of what principals the LLM declared.
 */
export function getTypeValidators(type: string): ValidatorName[] {
  return TYPE_POLICIES[type]?.typeValidators ?? []
}
