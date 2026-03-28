import { Input, Violation } from "../../types"

const BOUNDARY_VIOLATION_PATTERNS = [
  "bypass",
  "replace authority",
  "change architecture",
  "override authority",
  "circumvent",
  "skip approval",
  "ignore policy",
  "override policy",
]

/**
 * P5 — Respect Authority & Boundaries
 * Rejects proposals that attempt to bypass or modify established system boundaries.
 */
export const p5RespectAuthority = (input: Input): Violation[] => {
  const violations: Violation[] = []

  for (const action of input.proposal.plannedActions) {
    const intent = action.intent.toLowerCase()
    const cmd = (action.command ?? "").toLowerCase()
    const combinedText = intent + " " + cmd

    const matched = BOUNDARY_VIOLATION_PATTERNS.find((p) =>
      combinedText.includes(p)
    )

    if (matched) {
      violations.push({
        policyId: "P5",
        severity: "reject",
        message: `Action attempts to violate system authority or boundaries ("${matched}"): intent="${action.intent}". Respect established architecture and authority boundaries.`,
      })
    }
  }

  return violations
}
