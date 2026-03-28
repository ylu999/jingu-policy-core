import { Input, Violation } from "../../types"

/**
 * P11 — Correct Layer Diagnosis
 * Rejects reasoning frames where the problem layer is "unknown".
 */
export const p11LayerDiagnosis = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const frame = input.reasoningFrame

  if (!frame) return violations

  if (frame.problemLayer === "unknown") {
    violations.push({
      policyId: "P11",
      severity: "reject",
      message: `ReasoningFrame.problemLayer is "unknown". Diagnose whether the problem is in requirements, architecture, environment, state, or execution before proposing a fix.`,
    })
  }

  return violations
}
