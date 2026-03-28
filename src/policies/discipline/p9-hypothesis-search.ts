import { Input, Violation } from "../../types"

/**
 * P9 — Hypothesis-Driven Search
 * Rejects search actions that lack a stated hypothesis.
 */
export const p9HypothesisSearch = (input: Input): Violation[] => {
  const violations: Violation[] = []

  for (const action of input.proposal.plannedActions) {
    if (action.type === "search") {
      const hasHypothesis =
        action.hypothesis !== undefined && action.hypothesis.trim().length > 0

      if (!hasHypothesis) {
        violations.push({
          policyId: "P9",
          severity: "reject",
          message: `Search action "${action.intent}" has no hypothesis. Every search must be driven by a specific hypothesis to avoid aimless exploration.`,
        })
      }
    }
  }

  return violations
}
