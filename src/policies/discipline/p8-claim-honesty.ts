import { Input, Violation } from "../../types"

const STRONG_CLAIM_WORDS = [
  "completed",
  "successfully deployed",
  "done",
  "finished",
  "succeeded",
  "verified",
  "confirmed",
  "all tests pass",
  "fully working",
  "deployed successfully",
]

/**
 * P8 — Claim Honesty
 * Rejects strong completion claims when there is no supporting evidence.
 */
export const p8ClaimHonesty = (input: Input): Violation[] => {
  const violations: Violation[] = []

  if (!input.claim || input.claim.statements.length === 0) return violations

  const commandResults = input.evidence?.commandResults
  const hasEvidence =
    commandResults !== undefined && commandResults.length > 0

  for (const statement of input.claim.statements) {
    const lower = statement.toLowerCase()
    const matched = STRONG_CLAIM_WORDS.find((word) => lower.includes(word))

    if (matched && !hasEvidence) {
      violations.push({
        policyId: "P8",
        severity: "reject",
        message: `Claim contains strong assertion ("${matched}") but no command results provided as evidence. Claims must be grounded in observable output.`,
      })
    }
  }

  return violations
}
