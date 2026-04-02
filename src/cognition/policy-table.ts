/**
 * policy-table.ts — TYPE_PRINCIPAL_POLICY
 *
 * Deterministic table binding (type) to required and forbidden principals.
 * No LLM. Pure data.
 *
 * Unknown types → unconstrained (pass). Policy covers known types only.
 * Adding a new type requires an explicit entry here; absence is not a violation.
 */

export interface PrincipalPolicy {
  /** At least one of these must be present in the principals list. Empty = no requirement. */
  required: string[]
  /** None of these may be present in the principals list. */
  forbidden: string[]
}

export const TYPE_PRINCIPAL_POLICY: Record<string, PrincipalPolicy> = {
  root_cause_fix: {
    required: ["fix_cause_not_symptom"],
    forbidden: ["workaround_only", "surface_pattern_match"],
  },
  workaround_fix: {
    required: [],
    forbidden: ["fix_cause_not_symptom"],
  },
  exploration: {
    required: ["probe_until_signal"],
    forbidden: ["apply_patch"],
  },
  test_validation: {
    required: ["verify_before_submit"],
    forbidden: [],
  },
  environment_fix: {
    required: ["fix_environment_first"],
    forbidden: ["fix_cause_not_symptom"],
  },
}
