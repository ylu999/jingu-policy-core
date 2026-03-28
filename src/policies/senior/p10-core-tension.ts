import { Input, Violation } from "../../types"

const MIN_CORE_TENSION_LENGTH = 10

/**
 * P10 — Core Tension First
 * Rejects reasoning frames that fail to articulate the core tension.
 */
export const p10CoreTension = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const frame = input.reasoningFrame

  if (!frame) return violations

  if (
    !frame.coreTension ||
    frame.coreTension.trim().length < MIN_CORE_TENSION_LENGTH
  ) {
    violations.push({
      policyId: "P10",
      severity: "reject",
      message: `ReasoningFrame.coreTension is too short or missing (length: ${(frame.coreTension ?? "").trim().length}, minimum: ${MIN_CORE_TENSION_LENGTH}). Articulate the core tension driving this problem before proceeding.`,
    })
  }

  return violations
}
