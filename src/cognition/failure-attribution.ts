/**
 * failure-attribution.ts — CDP v1 Failure Attribution (p173)
 *
 * Responsibility boundary:
 *   - Consume ValidationError[] from p172 pipeline
 *   - Map each error to a phase/type/principal root-cause hypothesis
 *   - Select the primary attribution (highest-priority validator)
 *   - Assemble FailureTrace for downstream consumption (p173/p174, retry, metrics)
 *
 * Does NOT: make accept/reject decisions, rewrite issues, compensate for validator gaps.
 * Input: CDPValidationPipelineResult (or ValidationError[] directly)
 * Output: FailureAttribution[] + optional primaryAttribution
 */

import type { ValidatorName } from "./taxonomy.js"
import type { ValidationError } from "./validator-pipeline.js"
import { ValidationErrorCode } from "./validator-pipeline.js"
import type { FailureAttribution, AttributionRule, FailureTrace } from "./types.js"

// ── ATTRIBUTION_PRIORITY ──────────────────────────────────────────────────────
//
// Ordered list of validators for primary attribution selection.
// The first validator from this list that appears in the error set
// becomes the primary attribution anchor.

export const ATTRIBUTION_PRIORITY: ValidatorName[] = [
  "execution_check",
  "evidence_coverage",
  "no_unsupported_claim",
  "scope_check",
  "consistency_check",
  "coverage_check",
  "causal_link_check",
  "constraint_check",
  "diff_size_check",
]

// ── ATTRIBUTION_RULES ─────────────────────────────────────────────────────────
//
// 9 rules mapping ValidationErrorCodes → phase + principal hypotheses.
// Rules are matched in order; first match wins per error.

export const ATTRIBUTION_RULES: AttributionRule[] = [
  {
    errorCode:           ValidationErrorCode.MISSING_EVIDENCE_FOR_CLAIM,
    validator:           "evidence_coverage",
    attributedPhase:     "ANALYZE",
    attributedPrincipal: "evidence_based",
    confidence:          "high",
    reasonTemplate:      "Claim lacks traceable evidence source — evidence_based principal violated in ANALYZE phase",
  },
  {
    errorCode:           ValidationErrorCode.UNSUPPORTED_CLAIM,
    validator:           "no_unsupported_claim",
    attributedPhase:     "ANALYZE",
    attributedPrincipal: "no_hallucination",
    confidence:          "high",
    reasonTemplate:      "Claim goes beyond available evidence — no_hallucination principal violated in ANALYZE phase",
  },
  {
    errorCode:           ValidationErrorCode.SCOPE_VIOLATION,
    validator:           "scope_check",
    attributedPhase:     "EXECUTE",
    attributedPrincipal: "scope_control",
    confidence:          "high",
    reasonTemplate:      "Change exceeded declared scope boundary — scope_control principal violated in EXECUTE phase",
  },
  {
    errorCode:           ValidationErrorCode.EXECUTION_FAILED,
    validator:           "execution_check",
    attributedPhase:     "EXECUTE",
    attributedPrincipal: "execution_first",
    confidence:          "high",
    reasonTemplate:      "Execution step did not produce valid result — execution_first principal violated in EXECUTE phase",
  },
  {
    errorCode:           ValidationErrorCode.INCONSISTENT_STATE,
    validator:           "consistency_check",
    attributedPhase:     "ANALYZE",
    attributedPrincipal: "consistency_check",
    confidence:          "medium",
    reasonTemplate:      "Output contains internally inconsistent elements — consistency_check principal violated in ANALYZE phase",
  },
  {
    errorCode:           ValidationErrorCode.DIFF_TOO_LARGE,
    validator:           "diff_size_check",
    attributedPhase:     "EXECUTE",
    attributedPrincipal: "minimal_change",
    confidence:          "medium",
    reasonTemplate:      "Change diff exceeds allowed size — minimal_change principal violated in EXECUTE phase",
  },
  {
    errorCode:           ValidationErrorCode.INCOMPLETE_COVERAGE,
    validator:           "coverage_check",
    attributedPhase:     "PLAN",
    attributedPrincipal: "completeness",
    confidence:          "medium",
    reasonTemplate:      "Not all required aspects are addressed — completeness principal violated in PLAN phase",
  },
  {
    errorCode:           ValidationErrorCode.WEAK_CAUSAL_LINK,
    validator:           "causal_link_check",
    attributedPhase:     "ANALYZE",
    attributedPrincipal: "causality",
    confidence:          "medium",
    reasonTemplate:      "Causal chain between evidence and conclusion is incomplete — causality principal violated in ANALYZE phase",
  },
  {
    errorCode:           ValidationErrorCode.MISSING_HYPOTHESIS_FLOW,
    validator:           "coverage_check",
    attributedPhase:     "ANALYZE",
    attributedPrincipal: "hypothesis_testing",
    confidence:          "medium",
    reasonTemplate:      "Hypothesis → test → conclude flow absent — hypothesis_testing principal violated in ANALYZE phase",
  },
]

// ── attributeFailure ──────────────────────────────────────────────────────────
//
// Maps each ValidationError to a FailureAttribution.
// Match order: exact errorCode + validator match → errorCode-only match → unattributed (low confidence)

export function attributeFailure(
  declaration: { phase?: string; type: string; subType?: string; principals: string[] },
  errors: ValidationError[]
): FailureAttribution[] {
  return errors.map(err => {
    // Try exact match (errorCode + validator)
    const exactRule = ATTRIBUTION_RULES.find(
      r => r.errorCode === err.code && r.validator === err.validator
    )
    if (exactRule) {
      return _ruleToAttribution(exactRule, declaration, err)
    }

    // Try errorCode-only match
    const codeRule = ATTRIBUTION_RULES.find(r => r.errorCode === err.code)
    if (codeRule) {
      return _ruleToAttribution(codeRule, declaration, err)
    }

    // Fallback: unattributed with low confidence
    return {
      errorCode:  err.code,
      phase:      declaration.phase,
      type:       declaration.type,
      subType:    declaration.subType,
      confidence: "low",
      reason:     `No attribution rule found for error code "${err.code}" (validator: ${err.validator}). Manual review required.`,
    }
  })
}

function _ruleToAttribution(
  rule: AttributionRule,
  declaration: { phase?: string; type: string; subType?: string },
  err: ValidationError
): FailureAttribution {
  return {
    errorCode:   err.code,
    phase:       rule.attributedPhase,
    type:        declaration.type,
    subType:     declaration.subType,
    principal:   rule.attributedPrincipal,
    confidence:  rule.confidence,
    reason:      rule.reasonTemplate,
  }
}

// ── selectPrimaryAttribution ──────────────────────────────────────────────────
//
// Picks the single most explanatory attribution from the list.
// Selection strategy: first attribution whose error's validator appears in
// ATTRIBUTION_PRIORITY (in priority order). Falls back to first attribution.

export function selectPrimaryAttribution(
  attributions: FailureAttribution[],
  errors: ValidationError[]
): FailureAttribution | undefined {
  if (attributions.length === 0) return undefined

  // Build a map from errorCode to validator (from errors, for priority lookup)
  const errorValidatorMap = new Map<string, string>()
  for (const e of errors) {
    if (!errorValidatorMap.has(e.code)) {
      errorValidatorMap.set(e.code, e.validator)
    }
  }

  // Walk ATTRIBUTION_PRIORITY; return first attribution whose validator is in errors
  for (const priorityValidator of ATTRIBUTION_PRIORITY) {
    const match = attributions.find(
      a => errorValidatorMap.get(a.errorCode) === priorityValidator
    )
    if (match) return match
  }

  // Fallback: highest-confidence attribution
  const byConfidence: Record<string, number> = { high: 3, medium: 2, low: 1 }
  return [...attributions].sort(
    (a, b) => (byConfidence[b.confidence] ?? 0) - (byConfidence[a.confidence] ?? 0)
  )[0]
}

// ── buildFailureTrace ─────────────────────────────────────────────────────────
//
// Assembles a complete FailureTrace for a single failed run.
// This is the top-level output consumed by retry controllers, metrics, and p174.

export function buildFailureTrace(
  taskId: string,
  runId: string,
  declaration: { phase?: string; type: string; subType?: string; principals: string[] },
  validatorsRun: string[],
  errors: ValidationError[]
): FailureTrace {
  const attributions = attributeFailure(declaration, errors)
  const primaryAttribution = selectPrimaryAttribution(attributions, errors)

  return {
    taskId,
    runId,
    declaration,
    validatorsRun,
    errors,
    attributions,
    primaryAttribution,
    timestamp: new Date().toISOString(),
  }
}
