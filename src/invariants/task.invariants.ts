import { mergeResults, type InvariantCheckResult } from "./result.js"
import { checkTransitionHasVerify, checkVerifyIsEvidenceBased } from "./transition.invariants.js"

export function validateTaskDefinition(task: {
  verify?: { evidence_kind?: unknown }
}): InvariantCheckResult {
  const results = [
    checkTransitionHasVerify(task),
  ]

  // Only check evidence_kind if verify is present (avoids double-error on missing verify)
  if (task.verify != null) {
    results.push(checkVerifyIsEvidenceBased(task.verify))
  }

  return mergeResults(results)
}
