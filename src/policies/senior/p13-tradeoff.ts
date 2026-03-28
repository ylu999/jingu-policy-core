import { Input, Violation } from "../../types"

/**
 * P13 — Tradeoff Awareness
 * Rejects reasoning frames that acknowledge no tradeoffs.
 */
export const p13Tradeoff = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const frame = input.reasoningFrame

  if (!frame) return violations

  if (!frame.tradeoffs || frame.tradeoffs.length === 0) {
    violations.push({
      policyId: "P13",
      severity: "reject",
      message: `ReasoningFrame.tradeoffs is empty. Every engineering decision involves tradeoffs — document at least one before proceeding.`,
    })
  }

  return violations
}
