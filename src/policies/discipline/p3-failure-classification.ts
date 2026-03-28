import { Input, Violation } from "../../types"

/**
 * P3 — Failure Classification Before Retry
 * Rejects proposals that retry without classifying the failure first.
 */
export const p3FailureClassification = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const failureSignals = input.evidence?.failureSignals ?? []

  // Count "same_failure" signals
  const sameFailureCount = failureSignals.filter((s) =>
    s.toLowerCase().includes("same_failure")
  ).length

  if (sameFailureCount <= 1) return violations

  // Check if proposal introduces new hypotheses
  const hasNewHypothesis = input.proposal.plannedActions.some(
    (a) => a.hypothesis && a.hypothesis.trim().length > 0
  )

  if (!hasNewHypothesis) {
    violations.push({
      policyId: "P3",
      severity: "reject",
      message: `Detected ${sameFailureCount} repeated "same_failure" signals but no new hypothesis in proposal. Classify the failure before retrying.`,
    })
  }

  return violations
}
