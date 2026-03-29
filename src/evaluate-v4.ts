import { enforceReasoningFrame } from "./reasoning-gate"
import { allPolicies, seniorPolicies } from "./policies"
import type { Input, Violation, TypedPolicy } from "./types"

export type ReasoningGateResult =
  | { decision: "accept" }
  | { decision: "reject"; reason: string; requiredFix: string[] }

export type Grade = "A" | "B" | "C" | "D" | "F"

export type V4RegimeResult = {
  stage: "regime"
  decision: "accept" | "reject" | "block"
  score: number
  seniorityScore: number
  overallScore: number
  grade: Grade
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

export function scoreFromViolations(violations: Violation[], policyCount: number): number {
  if (policyCount === 0) return 100
  const penalty = violations.reduce((acc, v) => {
    if (v.severity === "block") return acc + 3
    if (v.severity === "reject") return acc + 2
    return acc + 1
  }, 0)
  const maxPenalty = policyCount * 3
  return Math.max(0, Math.round(100 - (penalty / maxPenalty) * 100))
}

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return "A"
  if (score >= 75) return "B"
  if (score >= 60) return "C"
  if (score >= 40) return "D"
  return "F"
}

export function decideFromViolations(violations: Violation[], reasoningViolations: Violation[]): "accept" | "reject" | "block" {
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
  const seniorityScore = scoreFromViolations(reasoningViolations, seniorPolicies.length)
  // Weighted: discipline 60%, seniority 40%
  const overallScore = Math.round(score * 0.6 + seniorityScore * 0.4)
  const grade = gradeFromScore(overallScore)
  const decision = decideFromViolations(violations, reasoningViolations)

  const total = violations.length + reasoningViolations.length
  let summary: string
  if (decision === "block") {
    const blocked = [...violations, ...reasoningViolations].filter(v => v.severity === "block")
    summary = `BLOCKED — ${blocked.length} critical violation(s). Score: ${overallScore}/100 (${grade}).`
  } else if (decision === "reject") {
    summary = `REJECTED — ${total} violation(s). Score: ${overallScore}/100 (${grade}).`
  } else if (total > 0) {
    summary = `ACCEPTED with warnings — ${total} issue(s). Score: ${overallScore}/100 (${grade}).`
  } else {
    summary = `ACCEPTED — No violations. Score: ${overallScore}/100 (${grade}).`
  }

  return {
    stage: "regime",
    decision,
    score,
    seniorityScore,
    overallScore,
    grade,
    violations,
    reasoningViolations,
    summary,
  }
}

// Alias for compatibility
export const evaluateV4Sync = evaluateV4

// ---------------------------------------------------------------------------
// Typed policy dispatch
//
// Runs a set of TypedPolicy instances against the typed claims in the input.
// Each TypedPolicy declares appliesTo: ClaimType[] — it is only invoked for
// claims whose type appears in that list.
//
// This is the bridge from the legacy "run all policies on Input" model to the
// formal "∀ claim: constraints(claim, evidence)" model.
//
// Usage:
//   const violations = runTypedPolicies(input, myTypedPolicies)
//
// To extend evaluateV4 with typed policies, pass them in via evaluateV4WithTyped.
// ---------------------------------------------------------------------------
export function runTypedPolicies(input: Input, typedPolicies: TypedPolicy[]): Violation[] {
  const claims = input.claim?.typed ?? []
  if (claims.length === 0 || typedPolicies.length === 0) return []

  const violations: Violation[] = []
  for (const claim of claims) {
    for (const policy of typedPolicies) {
      if (policy.appliesTo.includes(claim.type)) {
        violations.push(...policy.check(claim, input.evidence, input))
      }
    }
  }
  return violations
}

/**
 * evaluateV4WithTyped
 *
 * Extends evaluateV4 with an optional set of TypedPolicy instances.
 * TypedPolicies run after the regime evaluation; their violations are merged
 * into the discipline violations array (they are not "senior" by default).
 *
 * Callers that don't pass typedPolicies get identical behavior to evaluateV4.
 */
export function evaluateV4WithTyped(input: Input, typedPolicies?: TypedPolicy[]): V4StageResult {
  const base = evaluateV4(input)
  if (base.stage === "reasoning") return base
  if (!typedPolicies || typedPolicies.length === 0) return base

  const typedViolations = runTypedPolicies(input, typedPolicies)
  if (typedViolations.length === 0) return base

  const violations = [...base.violations, ...typedViolations]
  const score = scoreFromViolations(violations, allPolicies.length + typedPolicies.length)
  const overallScore = Math.round(score * 0.6 + base.seniorityScore * 0.4)
  const grade = gradeFromScore(overallScore)
  const decision = decideFromViolations(violations, base.reasoningViolations)

  const total = violations.length + base.reasoningViolations.length
  let summary: string
  if (decision === "block") {
    const blocked = [...violations, ...base.reasoningViolations].filter(v => v.severity === "block")
    summary = `BLOCKED — ${blocked.length} critical violation(s). Score: ${overallScore}/100 (${grade}).`
  } else if (decision === "reject") {
    summary = `REJECTED — ${total} violation(s). Score: ${overallScore}/100 (${grade}).`
  } else if (total > 0) {
    summary = `ACCEPTED with warnings — ${total} issue(s). Score: ${overallScore}/100 (${grade}).`
  } else {
    summary = `ACCEPTED — No violations. Score: ${overallScore}/100 (${grade}).`
  }

  return {
    stage: "regime",
    decision,
    score,
    seniorityScore: base.seniorityScore,
    overallScore,
    grade,
    violations,
    reasoningViolations: base.reasoningViolations,
    summary,
  }
}
