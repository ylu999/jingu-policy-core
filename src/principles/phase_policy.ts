/**
 * phase_policy.ts — Phase-specific invariants for the jingu-swebench activation layer.
 *
 * Each phase has a set of REQUIRES (must be true before exiting phase)
 * and FORBIDS (must not be true during phase).
 *
 * These are the L2 machine-checkable expressions of the jingu design principles (L1).
 * L3 runtime enforcement is in run_with_jingu_gate.py (p186–p192).
 */

export type Phase = "OBSERVE" | "ANALYZE" | "EXECUTE" | "JUDGE" | "VERIFY";

export interface PhaseContract {
  /** Required principals — must be declared in PhaseRecord.principals */
  required_principals: string[];
  /** Required fields — must be non-empty in PhaseRecord */
  required_fields: string[];
  /** Actions forbidden during this phase */
  forbidden_actions: string[];
  /** Which principle this contract enforces */
  principle_ref: string;
}

/**
 * Phase contracts — the typed contract for each phase.
 *
 * Derived from jingu design principles:
 * - P2: Typed Contracts Over Prompts
 * - P4: Phase Boundaries Must Be Strict
 * - P7: Cognition Must Be Declared and Validated
 */
export const PHASE_CONTRACTS: Record<Phase, PhaseContract> = {
  OBSERVE: {
    required_principals: [],
    required_fields: ["evidence_refs"],
    forbidden_actions: ["write_patch", "call_test_runner"],
    principle_ref: "P4 — Phase Boundaries Must Be Strict",
  },

  ANALYZE: {
    required_principals: ["causal_grounding"],
    required_fields: ["claims", "evidence_refs"],
    forbidden_actions: ["write_patch", "call_test_runner"],
    principle_ref: "P2 — Typed Contracts; P7 — Declared Cognition",
  },

  EXECUTE: {
    required_principals: ["minimal_change"],
    required_fields: ["claims"],
    forbidden_actions: ["call_test_runner"],
    principle_ref: "P2 — Typed Contracts; P5 — Fail Fast",
  },

  JUDGE: {
    required_principals: ["invariant_preservation"],
    required_fields: ["claims", "evidence_refs"],
    forbidden_actions: [],
    principle_ref: "P2 — Typed Contracts; P7 — Declared Cognition",
  },

  VERIFY: {
    required_principals: [],
    required_fields: [],
    forbidden_actions: ["write_patch"],
    principle_ref: "P3 — Admit or Reject; P8 — In-Loop Governance",
  },
};

// ── Invariant check functions ─────────────────────────────────────────────────

export interface PhaseContractCheckResult {
  phase: Phase;
  passed: boolean;
  missing_principals: string[];
  missing_fields: string[];
  violation_code: string | null;
}

/**
 * Check whether a PhaseRecord satisfies the contract for the given phase.
 *
 * @param phase - The phase being exited
 * @param principals - Declared principals from PhaseRecord.principals
 * @param fields - Non-empty fields from the PhaseRecord (field name → truthy/falsy)
 */
export function checkPhaseContract(
  phase: Phase,
  principals: string[],
  fields: Record<string, boolean>,
): PhaseContractCheckResult {
  const contract = PHASE_CONTRACTS[phase];
  if (!contract) {
    return {
      phase,
      passed: true,
      missing_principals: [],
      missing_fields: [],
      violation_code: null,
    };
  }

  const normalizedPrincipals = principals.map((p) => p.toLowerCase());

  const missing_principals = contract.required_principals.filter(
    (req) => !normalizedPrincipals.includes(req.toLowerCase()),
  );

  const missing_fields = contract.required_fields.filter(
    (field) => !fields[field],
  );

  const passed = missing_principals.length === 0 && missing_fields.length === 0;

  const violation_code = passed
    ? null
    : missing_principals.length > 0
      ? `missing_principal:${missing_principals[0]}`
      : `missing_field:${missing_fields[0]}`;

  return { phase, passed, missing_principals, missing_fields, violation_code };
}

/**
 * Check that an action is not forbidden in the given phase.
 *
 * @param phase - Current phase
 * @param action - Action being attempted
 */
export function checkPhaseAction(
  phase: Phase,
  action: string,
): { allowed: boolean; violation_code: string | null } {
  const contract = PHASE_CONTRACTS[phase];
  if (!contract) {
    return { allowed: true, violation_code: null };
  }

  const forbidden = contract.forbidden_actions.includes(action);
  return {
    allowed: !forbidden,
    violation_code: forbidden ? `forbidden_action:${action}_in_${phase}` : null,
  };
}
