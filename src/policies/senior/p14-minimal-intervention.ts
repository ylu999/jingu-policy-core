import { Input, Violation } from "../../types"

const MIN_INTERVENTION_LENGTH = 10

/**
 * P14 — Minimal Sufficient Intervention
 * Rejects reasoning frames where the proposed intervention is too vague.
 */
export const p14MinimalIntervention = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const frame = input.reasoningFrame

  if (!frame) return violations

  if (
    !frame.proposedIntervention ||
    frame.proposedIntervention.trim().length < MIN_INTERVENTION_LENGTH
  ) {
    violations.push({
      policyId: "P14",
      severity: "reject",
      message: `ReasoningFrame.proposedIntervention is too short or missing (length: ${(frame.proposedIntervention ?? "").trim().length}, minimum: ${MIN_INTERVENTION_LENGTH}). Describe a concrete, minimal intervention.`,
    })
  }

  return violations
}
