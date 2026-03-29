import type { ReasoningFrame, TypedClaim, Evidence } from "./types"
import { checkReasoningCoherence } from "./coherence-check.js"

export type ReasoningGateResult =
  | { decision: "accept" }
  | { decision: "reject"; reason: string; requiredFix: string[] }

/**
 * enforceReasoningFrame
 *
 * Gate 1 of evaluateV4 pipeline.
 * No action without reasoning.
 * If you can't explain it, you can't do it.
 *
 * Two layers of validation:
 * 1. Field existence — required fields must be present and non-trivial
 * 2. Coherence check — the reasoning chain must be internally consistent
 */
export function enforceReasoningFrame(input: {
  reasoningFrame?: ReasoningFrame
  claim?: { typed?: TypedClaim[] }
  evidence?: Evidence
}): ReasoningGateResult {
  if (!input.reasoningFrame) {
    return {
      decision: "reject",
      reason: "Missing reasoning frame",
      requiredFix: [
        "Add a reasoningFrame with: coreTension, problemLayer, hypotheses, tradeoffs, proposedIntervention, nextStep",
        "You must explain your thinking before any action is allowed",
      ],
    }
  }

  const f = input.reasoningFrame
  const issues: string[] = []
  const fixes: string[] = []

  if (!f.coreTension || f.coreTension.trim().length < 10) {
    issues.push("Missing or weak core tension")
    fixes.push("Define the core engineering conflict: what constraints are in tension?")
  }

  if (!f.problemLayer || f.problemLayer === "unknown") {
    issues.push("Problem layer not identified")
    fixes.push("Identify the abstraction layer: requirements / architecture / environment / state / execution")
  }

  if (!f.hypotheses || f.hypotheses.length === 0) {
    issues.push("No hypotheses provided")
    fixes.push("State at least one hypothesis about the cause before proposing a fix")
  }

  if (!f.tradeoffs || f.tradeoffs.length === 0) {
    issues.push("No tradeoff analysis")
    fixes.push("Explain what you optimize vs what you sacrifice (e.g. 'speed vs correctness')")
  }

  if (!f.proposedIntervention || f.proposedIntervention.trim().length < 10) {
    issues.push("No intervention defined")
    fixes.push("Define the specific action you propose to take")
  }

  if (!f.nextStep || f.nextStep.trim().length === 0) {
    issues.push("Next step not defined")
    fixes.push("State the single immediate next action")
  }

  if (issues.length > 0) {
    return {
      decision: "reject",
      reason: issues.join("; "),
      requiredFix: fixes,
    }
  }

  // Stage 2: Coherence check — validate the reasoning chain is internally consistent
  const coherence = checkReasoningCoherence(f, input.claim?.typed, input.evidence)
  if (!coherence.coherent) {
    const rejectIssues = coherence.issues.filter(i => i.severity === "reject")
    if (rejectIssues.length > 0) {
      return {
        decision: "reject",
        reason: rejectIssues.map(i => `[${i.chain}] ${i.issue}`).join("; "),
        requiredFix: rejectIssues.map(i => `Fix ${i.chain}: ${i.issue.split(".")[0]}`),
      }
    }
    // Only warnings — allow through (caller can inspect coherence result separately)
  }

  return { decision: "accept" }
}
