import { InvariantCodes } from "./codes.js"
import { pass, fail, type InvariantCheckResult } from "./result.js"

export function checkCandidateCannotWriteCanonicalState(
  { actor_kind, attempted_canonical_write }: { actor_kind: "candidate" | "orchestrator"; attempted_canonical_write: boolean }
): InvariantCheckResult {
  if (actor_kind === "candidate" && attempted_canonical_write) {
    return fail({
      code: InvariantCodes.CANDIDATE_WRITES_CANONICAL_STATE,
      severity: "error",
      message: "Candidate actors must not write canonical state directly. Only orchestrators may commit canonical state.",
      details: { actor_kind },
    })
  }
  return pass()
}

export function checkMergedResultWasReverified(
  { merged, merged_verify_passed }: { merged: boolean; merged_verify_passed: boolean }
): InvariantCheckResult {
  if (merged && !merged_verify_passed) {
    return fail({
      code: InvariantCodes.MERGED_RESULT_NOT_REVERIFIED,
      severity: "error",
      message: "Merged result was not re-verified. Every merge operation must be followed by a passing verify before state advances.",
    })
  }
  return pass()
}
