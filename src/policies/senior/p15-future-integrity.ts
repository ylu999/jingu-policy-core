import { Input, Violation } from "../../types"

/**
 * P15 — Future-State Integrity
 * Warns when no recurrence prevention strategy is documented.
 */
export const p15FutureIntegrity = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const frame = input.reasoningFrame

  if (!frame) return violations

  if (
    !frame.recurrencePrevention ||
    frame.recurrencePrevention.trim().length === 0
  ) {
    violations.push({
      policyId: "P15",
      severity: "warning",
      message: `ReasoningFrame.recurrencePrevention is not set. Document how this problem will be prevented from recurring.`,
    })
  }

  return violations
}
