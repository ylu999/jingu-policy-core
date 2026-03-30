import { InvariantCodes } from "./codes.js"
import { pass, fail, type InvariantCheckResult } from "./result.js"

export function checkTransitionHasVerify(
  transition: { verify?: unknown }
): InvariantCheckResult {
  if (transition.verify == null) {
    return fail({
      code: InvariantCodes.MISSING_VERIFY,
      severity: "error",
      message: "Transition must have a verify step. Every state advance requires evidence.",
    })
  }
  return pass()
}

export function checkVerifyIsEvidenceBased(
  verify: { evidence_kind?: unknown }
): InvariantCheckResult {
  if (verify.evidence_kind == null) {
    return fail({
      code: InvariantCodes.VERIFY_NOT_EVIDENCE_BASED,
      severity: "error",
      message: "Verify must declare evidence_kind. Verification without observable evidence is not acceptable.",
    })
  }
  return pass()
}

export function checkTransitionAdvanceAllowed(
  { verify_passed, attempted_state_change }: { verify_passed: boolean; attempted_state_change: boolean }
): InvariantCheckResult {
  if (!verify_passed && attempted_state_change) {
    return fail({
      code: InvariantCodes.TRANSITION_WITHOUT_PASSING_VERIFY,
      severity: "error",
      message: "State cannot advance without a passing verify. Attempted state change rejected.",
    })
  }
  return pass()
}

export function checkStateMutationIsBackedByTransition(
  { state_changed, has_transition_record }: { state_changed: boolean; has_transition_record: boolean }
): InvariantCheckResult {
  if (state_changed && !has_transition_record) {
    return fail({
      code: InvariantCodes.STATE_CHANGED_WITHOUT_TRANSITION,
      severity: "error",
      message: "State changed but no transition record exists. Every mutation must be backed by a recorded transition.",
    })
  }
  return pass()
}
