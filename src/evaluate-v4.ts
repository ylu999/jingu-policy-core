import { enforceReasoningFrame } from "./reasoning-gate"
import { allPolicies, seniorPolicies } from "./policies"
import type { Input, Violation } from "./types"

export type ReasoningGateResult =
  | { decision: "accept" }
  | { decision: "reject"; reason: string; requiredFix: string[] }

export type V4RegimeResult = {
  stage: "regime"
  decision: "accept" | "reject" | "block"
  score: number
  violations: Violation[]
  reasoningViolations: Violation[]
  summary: string
}

export type V4ReasoningRejectResult = {
  stage: "reasoning"
  decision: "reject"
  reason: string
  requiredFix: string[]
}

export type V4StageResult = V4ReasoningRejectResult | V4RegimeResult

function scoreFromViolations(violations: Violation[], policyCount: number): number {
  if (policyCount === 0) return 100
  const penalty = violations.reduce((acc, v) => {
    if (v.severity === "block") return acc + 3
    if (v.severity === "reject") return acc + 2
    return acc + 1
  }, 0)
  const maxPenalty = policyCount * 3
  return Math.max(0, Math.round(100 - (penalty / maxPenalty) * 100))
}

function decideFromViolations(violations: Violation[], reasoningViolations: Violation[]): "accept" | "reject" | "block" {
  const all = [...violations, ...reasoningViolations]
  if (all.some(v => v.severity === "block")) return "block"
  if (all.some(v => v.severity === "reject")) return "reject"
  return "accept"
}

/**
 * evaluateV4
 *
 * Full pipeline:
 * 1. enforceReasoningFrame — must pass before ANY regime evaluation
 * 2. Regime evaluation — P1-P16 discipline + senior reasoning
 *
 * "No action without reasoning."
 */
export function evaluateV4(input: Input): V4StageResult {
  // Stage 1: Reasoning Gate
  const reasoningCheck = enforceReasoningFrame(input)
  if (reasoningCheck.decision !== "accept") {
    return {
      stage: "reasoning",
      decision: "reject",
      reason: reasoningCheck.reason,
      requiredFix: reasoningCheck.requiredFix,
    }
  }

  // Stage 2: Regime evaluation (P1-P9 discipline + P10-P16 senior)
  const violations: Violation[] = []
  for (const policy of allPolicies) {
    violations.push(...policy(input))
  }

  const reasoningViolations: Violation[] = []
  for (const policy of seniorPolicies) {
    reasoningViolations.push(...policy(input))
  }

  const score = scoreFromViolations(violations, allPolicies.length)
  const decision = decideFromViolations(violations, reasoningViolations)

  const total = violations.length + reasoningViolations.length
  let summary: string
  if (decision === "block") {
    const blocked = [...violations, ...reasoningViolations].filter(v => v.severity === "block")
    summary = `BLOCKED — ${blocked.length} critical violation(s). Score: ${score}/100.`
  } else if (decision === "reject") {
    summary = `REJECTED — ${total} violation(s). Score: ${score}/100.`
  } else if (total > 0) {
    summary = `ACCEPTED with warnings — ${total} issue(s). Score: ${score}/100.`
  } else {
    summary = `ACCEPTED — No violations. Score: ${score}/100.`
  }

  return {
    stage: "regime",
    decision,
    score,
    violations,
    reasoningViolations,
    summary,
  }
}

// Alias for compatibility
export const evaluateV4Sync = evaluateV4
