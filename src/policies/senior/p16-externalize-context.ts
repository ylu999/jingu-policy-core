import { Input, Violation } from "../../types"

/**
 * P16 — Externalize Working Context
 *
 * Principle: Task-critical working context must be externalized into durable project artifacts.
 * The agent must not rely on transient memory for reasoning that affects action, retry, or completion.
 *
 * Slogan: "Memory is not state"
 */
export function p16ExternalizeContext(input: Input): Violation[] {
  const violations: Violation[] = []

  // Detect 1: Starting proposal/mutation without any context artifact reference
  // If proposal has write/command actions but no evidence of context being written
  const hasWriteOrCommand = input.proposal.plannedActions.some(
    a => a.type === "write" || a.type === "command"
  )
  const hasContextRef =
    input.evidence?.observations?.some(o =>
      o.toLowerCase().includes(".jingu/context") ||
      o.toLowerCase().includes("active-task") ||
      o.toLowerCase().includes("working context")
    ) ||
    input.evidence?.commandResults?.some(r =>
      r.toLowerCase().includes(".jingu/context") ||
      r.toLowerCase().includes("active-task")
    )

  if (hasWriteOrCommand && !hasContextRef && !input.reasoningFrame?.coreTension) {
    violations.push({
      policyId: "P16",
      severity: "reject",
      message:
        "Context not externalized before action. Write working context (facts, hypotheses, plan, next step) to .jingu/context/ before proposing mutations.",
    })
  }

  // Detect 2: Retry without updating context
  const sameFailures = (input.evidence?.failureSignals || []).filter(
    f => f === "same_failure"
  ).length
  if (sameFailures >= 2) {
    const contextUpdated =
      input.evidence?.observations?.some(o =>
        o.toLowerCase().includes("updated context") ||
        o.toLowerCase().includes("context updated") ||
        o.toLowerCase().includes("active-task updated")
      )
    if (!contextUpdated) {
      violations.push({
        policyId: "P16",
        severity: "reject",
        message:
          "Retry detected without updating working context. Before retrying, update .jingu/context/active-task with new failure facts and revised hypotheses.",
      })
    }
  }

  // Detect 3: Completion claim without final context/evidence summary
  const hasClaim = (input.claim?.statements || []).some(s => {
    const lower = s.toLowerCase()
    return (
      lower.includes("completed") ||
      lower.includes("resolved") ||
      lower.includes("done") ||
      lower.includes("fixed") ||
      lower.includes("deployed")
    )
  })
  const hasEvidenceSummary =
    (input.evidence?.commandResults || []).length > 0 ||
    input.evidence?.observations?.some(o =>
      o.toLowerCase().includes("evidence") ||
      o.toLowerCase().includes("verified") ||
      o.toLowerCase().includes("confirmed")
    )

  if (hasClaim && !hasEvidenceSummary) {
    violations.push({
      policyId: "P16",
      severity: "reject",
      message:
        "Completion claim made without durable evidence summary. Write final working state and evidence refs to .jingu/context/ before claiming completion.",
    })
  }

  // Detect 4: ReasoningFrame provided but key fields empty (context not properly externalized)
  const frame = input.reasoningFrame
  if (frame) {
    const isHollow =
      frame.coreTension.length < 10 &&
      frame.symptoms.length === 0 &&
      frame.hypotheses.length === 0 &&
      frame.verifiedFacts.length === 0

    if (isHollow) {
      violations.push({
        policyId: "P16",
        severity: "warning",
        message:
          "ReasoningFrame exists but is empty — working context not externalized. Fill in known facts, hypotheses, and current plan.",
      })
    }
  }

  return violations
}
