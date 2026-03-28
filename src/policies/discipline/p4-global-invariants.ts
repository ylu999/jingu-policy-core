import { Input, Violation } from "../../types"

const QUICK_FIX_PATTERNS = [
  "quick fix",
  "temporary",
  "workaround",
  "temp fix",
  "hotfix",
  "hack",
  "bandaid",
  "band-aid",
]

const FOLLOWUP_PATTERNS = [
  "will be fixed",
  "follow up",
  "follow-up",
  "tracked",
  "ticket",
  "todo",
  "will address",
  "short term",
  "short-term",
  "interim",
  "permanent fix",
  "long term",
  "long-term",
]

/**
 * P4 — Global Invariants Over Local Progress
 * Rejects or blocks proposals that introduce quick fixes without follow-up plans.
 */
export const p4GlobalInvariants = (input: Input): Violation[] => {
  const violations: Violation[] = []

  const summary = input.proposal.summary.toLowerCase()
  const reasoning = (input.proposal.reasoning ?? "").toLowerCase()
  const allText = summary + " " + reasoning

  const actionIntents = input.proposal.plannedActions
    .map((a) => a.intent.toLowerCase())
    .join(" ")

  const combinedText = allText + " " + actionIntents

  const matchedQuickFix = QUICK_FIX_PATTERNS.find((p) =>
    combinedText.includes(p)
  )

  if (!matchedQuickFix) return violations

  const hasFollowup = FOLLOWUP_PATTERNS.some((p) => combinedText.includes(p))

  if (!hasFollowup) {
    violations.push({
      policyId: "P4",
      severity: "reject",
      message: `Proposal contains quick-fix language ("${matchedQuickFix}") without a documented follow-up plan. Global invariants must not be compromised for local progress.`,
    })
  }

  return violations
}
