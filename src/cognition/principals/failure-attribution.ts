/**
 * failure-attribution.ts — CDP v1 Principal Violation Attribution (p174)
 *
 * Maps PrincipalValidatorError codes to specific principal violations.
 * Distinct from p173 (which maps ValidationError → phase/principal).
 * This layer operates on ADMITTED declarations — it explains policy-level violations.
 */

import type { PrincipalId } from "./taxonomy.js"
import type { PrincipalValidatorCode, PrincipalValidatorError } from "./validators.js"
import { PrincipalValidatorCode as PVC } from "./validators.js"

// ── PrincipalViolation ────────────────────────────────────────────────────────

export interface PrincipalViolation {
  errorCode:  PrincipalValidatorCode
  principal:  PrincipalId | null
  confidence: "high" | "medium" | "low"
  reason:     string
}

// ── PRINCIPAL_VIOLATION_RULES ─────────────────────────────────────────────────

interface PrincipalViolationRule {
  errorCode:  PrincipalValidatorCode
  principal:  PrincipalId | null
  confidence: "high" | "medium" | "low"
  reasonTemplate: string
}

export const PRINCIPAL_VIOLATION_RULES: PrincipalViolationRule[] = [
  {
    errorCode:      PVC.UNSUPPORTED_CLAIM,
    principal:      "P_REASON_EVIDENCE_GROUNDED",
    confidence:     "high",
    reasonTemplate: "Claim lacks evidence reference — P_REASON_EVIDENCE_GROUNDED violated",
  },
  {
    errorCode:      PVC.MISSING_REQUIRED_PRINCIPAL,
    principal:      "P_DEBUG_ROOT_CAUSE_ISOLATION",
    confidence:     "high",
    reasonTemplate: "Required principal for type missing — type-principal policy violated",
  },
  {
    errorCode:      PVC.UNSUPPORTED_ATTRIBUTION,
    principal:      "P_DEBUG_VERIFY_BEFORE_ATTRIBUTION",
    confidence:     "high",
    reasonTemplate: "Attribution present without evidence — P_DEBUG_VERIFY_BEFORE_ATTRIBUTION violated",
  },
  {
    errorCode:      PVC.INSUFFICIENT_LAYER_CHECK,
    principal:      "P_DEBUG_LAYER_ORDER",
    confidence:     "medium",
    reasonTemplate: "Layer coverage insufficient — P_DEBUG_LAYER_ORDER requires ≥2 distinct layers",
  },
]

// ── attributePrincipalViolation ───────────────────────────────────────────────

export function attributePrincipalViolation(
  errors: PrincipalValidatorError[]
): PrincipalViolation[] {
  return errors.map(err => {
    const rule = PRINCIPAL_VIOLATION_RULES.find(r => r.errorCode === err.code)
    if (rule) {
      return {
        errorCode:  err.code,
        principal:  rule.principal,
        confidence: rule.confidence,
        reason:     rule.reasonTemplate,
      }
    }
    // Fallback: unattributed
    return {
      errorCode:  err.code,
      principal:  null,
      confidence: "low",
      reason:     `No attribution rule for error code "${err.code}"`,
    }
  })
}
