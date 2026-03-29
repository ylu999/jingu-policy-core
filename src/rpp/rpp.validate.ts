// src/rpp/rpp.validate.ts

import { RPPRecord, RPPFailure, RPPValidationResult, CognitiveStep, Reference } from "./rpp.types.js"
import { isHardFailure } from "./rpp.failures.js"

const REQUIRED_STAGES: Array<CognitiveStep["stage"]> = [
  "interpretation",
  "reasoning",
  "decision",
  "action",
]

const RULE_METHOD_ID_PATTERN = /^[A-Z]+-\d+$/

const CERTAINTY_WORDS = [
  "is definitely",
  "always",
  "never",
  "must be",
  "certainly",
]

function validateReference(ref: Reference, stage: CognitiveStep["stage"] | "response"): RPPFailure | null {
  if (ref.type === "rule") {
    if (!RULE_METHOD_ID_PATTERN.test(ref.rule_id)) {
      return {
        code: "INVALID_REFERENCE",
        stage,
        detail: `RuleRef has invalid rule_id: "${ref.rule_id}". Must match /^[A-Z]+-\\d+$/.`,
      }
    }
  } else if (ref.type === "method") {
    if (!RULE_METHOD_ID_PATTERN.test(ref.method_id)) {
      return {
        code: "INVALID_REFERENCE",
        stage,
        detail: `MethodRef has invalid method_id: "${ref.method_id}". Must match /^[A-Z]+-\\d+$/.`,
      }
    }
  } else if (ref.type === "evidence") {
    if (!ref.source || typeof ref.source !== "string" || ref.source.trim() === "") {
      return {
        code: "INVALID_REFERENCE",
        stage,
        detail: `EvidenceRef has empty or missing 'source' field.`,
      }
    }
    if (!ref.locator || typeof ref.locator !== "string" || ref.locator.trim() === "") {
      return {
        code: "INVALID_REFERENCE",
        stage,
        detail: `EvidenceRef has empty or missing 'locator' field.`,
      }
    }
  }
  return null
}

/**
 * Extract the first noun phrase from a string (min 3 chars).
 * Simple heuristic: take the first word of length >= 3.
 */
function extractFirstKeyPhrase(text: string): string | null {
  const words = text.split(/\s+/)
  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z0-9]/g, "")
    if (cleaned.length >= 3) {
      return cleaned.toLowerCase()
    }
  }
  return null
}

export function validateRPP(record: RPPRecord): RPPValidationResult {
  const allIssues: RPPFailure[] = []

  // --- Check 1: MISSING_STAGE ---
  const presentStages = new Set(record.steps.map((s) => s.stage))
  for (const required of REQUIRED_STAGES) {
    if (!presentStages.has(required)) {
      allIssues.push({
        code: "MISSING_STAGE",
        stage: required,
        detail: `Required stage "${required}" is missing from the RPP record.`,
      })
    }
  }

  // For checks 2–7, iterate over present steps only
  for (const step of record.steps) {
    const stage = step.stage

    // --- Check 2: EMPTY_CONTENT ---
    if (!step.content || step.content.length < 1) {
      allIssues.push({
        code: "EMPTY_CONTENT",
        stage,
        detail: `Stage "${stage}" has empty content array.`,
      })
    }

    // --- Check 3: NO_REFERENCES ---
    if (!step.references || step.references.length < 1) {
      allIssues.push({
        code: "NO_REFERENCES",
        stage,
        detail: `Stage "${stage}" has no references.`,
      })
    }

    // --- Check 4: SUPPORTS_TOO_VAGUE (warning) ---
    for (const ref of step.references ?? []) {
      if (ref.supports.length < 10) {
        allIssues.push({
          code: "SUPPORTS_TOO_VAGUE",
          stage,
          detail: `Reference in stage "${stage}" has a 'supports' field that is too vague: "${ref.supports}".`,
        })
      }
    }

    // --- Check 5: INVALID_REFERENCE ---
    for (const ref of step.references ?? []) {
      const failure = validateReference(ref, stage)
      if (failure) {
        allIssues.push(failure)
      }
    }
  }

  // --- Check 6: UNJUSTIFIED_DECISION ---
  const decisionStep = record.steps.find((s) => s.stage === "decision")
  if (decisionStep) {
    const hasRuleOrMethod = decisionStep.references.some(
      (ref) => ref.type === "rule" || ref.type === "method"
    )
    if (!hasRuleOrMethod) {
      allIssues.push({
        code: "UNJUSTIFIED_DECISION",
        stage: "decision",
        detail: `Decision stage has no rule or method reference to justify the decision.`,
      })
    }
  }

  // --- Check 7: INFERENCE_AS_FACT (warning) ---
  const reasoningStep = record.steps.find((s) => s.stage === "reasoning")
  if (reasoningStep) {
    const hasEvidenceRef = reasoningStep.references.some((ref) => ref.type === "evidence")
    if (!hasEvidenceRef) {
      for (const contentItem of reasoningStep.content ?? []) {
        const lower = contentItem.toLowerCase()
        const hasCertaintyWord = CERTAINTY_WORDS.some((word) => lower.includes(word))
        if (hasCertaintyWord) {
          allIssues.push({
            code: "INFERENCE_AS_FACT",
            stage: "reasoning",
            detail: `Reasoning stage content uses certainty language ("${CERTAINTY_WORDS.find((w) => lower.includes(w))}") without any evidence reference: "${contentItem.slice(0, 80)}${contentItem.length > 80 ? "..." : ""}"`,
          })
        }
      }
    }
  }

  // --- Check 8: UNTRACEABLE_RESPONSE ---
  // Gather all prior step content strings
  const allPriorContent = record.steps.flatMap((s) => s.content ?? []).map((c) => c.toLowerCase())

  if (record.response.content.length > 0) {
    let anyTraced = false
    for (const responseItem of record.response.content) {
      const keyPhrase = extractFirstKeyPhrase(responseItem)
      if (keyPhrase !== null) {
        const traced = allPriorContent.some((priorContent) => priorContent.includes(keyPhrase))
        if (traced) {
          anyTraced = true
          break
        }
      }
    }
    if (!anyTraced) {
      allIssues.push({
        code: "UNTRACEABLE_RESPONSE",
        stage: "response",
        detail: `None of the response content items could be traced back to any prior step's content.`,
      })
    }
  }

  // --- Compute overall_status ---
  const failures = allIssues.filter((issue) => isHardFailure(issue.code))
  const warnings = allIssues.filter((issue) => !isHardFailure(issue.code))

  let overall_status: RPPValidationResult["overall_status"]
  if (failures.length > 0) {
    overall_status = "invalid"
  } else if (warnings.length > 0) {
    overall_status = "weakly_supported"
  } else {
    overall_status = "valid"
  }

  return { overall_status, failures, warnings }
}
