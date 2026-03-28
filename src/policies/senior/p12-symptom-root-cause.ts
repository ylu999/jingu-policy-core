import { Input, Violation } from "../../types"

/**
 * P12 — Symptom vs Root Cause Separation
 * Rejects/warns when symptoms, hypotheses, or verified facts are empty.
 */
export const p12SymptomRootCause = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const frame = input.reasoningFrame

  if (!frame) return violations

  if (!frame.symptoms || frame.symptoms.length === 0) {
    violations.push({
      policyId: "P12",
      severity: "reject",
      message: `ReasoningFrame.symptoms is empty. List observed symptoms before diagnosing root cause.`,
    })
  }

  if (!frame.hypotheses || frame.hypotheses.length === 0) {
    violations.push({
      policyId: "P12",
      severity: "reject",
      message: `ReasoningFrame.hypotheses is empty. Formulate at least one root cause hypothesis before proposing a fix.`,
    })
  }

  if (!frame.verifiedFacts || frame.verifiedFacts.length === 0) {
    violations.push({
      policyId: "P12",
      severity: "warning",
      message: `ReasoningFrame.verifiedFacts is empty. Support your diagnosis with verified facts to increase confidence.`,
    })
  }

  return violations
}
