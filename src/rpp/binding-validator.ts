// src/rpp/binding-validator.ts
// Unit 2.1: RPP Binding Validator + Strictness Policy
//
// Two-layer validator for RPP records:
//   Layer A (validateRPPBinding):   structural binding — chain connectivity, id uniqueness,
//                                   ref existence. Hard fails only.
//   Layer B (checkRPPStrictness):   support-type policy — which stages need which ref types.
//                                   Two hard fails (UNJUSTIFIED_DECISION, ACTION_NO_EVIDENCE),
//                                   two warnings (RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION,
//                                   SUPPORTS_MINIMAL).
//
// ValidationResult is split into three phases so event log (Unit 2.3) can emit
// separate rpp_schema_validated / rpp_binding_validated / rpp_strictness_checked events.

import type { RPPRecord, CognitiveStep, Reference } from "jingu-protocol"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BindingReasonCode =
  // Layer A — structural binding (hard fails)
  | "MISSING_REQUIRED_STAGE"
  | "DUPLICATE_STEP_ID"
  | "EMPTY_CONTENT"
  | "EMPTY_REFERENCES"
  | "UNTRACEABLE_RESPONSE"
  | "EMPTY_PROVENANCE_LINK"
  | "DANGLING_STEP_REFERENCE"
  | "UNGROUNDED_PROVENANCE_TARGET"
  | "STEP_DERIVED_REF_FORBIDDEN"
  | "INVALID_RULE_ID"
  | "INVALID_METHOD_ID"
  | "EMPTY_LOCATOR"
  | "EMPTY_SUPPORTS"
  // Layer B — strictness policy (hard fails)
  | "UNJUSTIFIED_DECISION"
  | "ACTION_NO_EVIDENCE"
  // Layer B — strictness policy (warnings)
  | "RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION"
  | "SUPPORTS_MINIMAL"

export interface ValidationIssue {
  code: BindingReasonCode
  step_id?: string       // which step triggered this (if applicable)
  ref_index?: number     // which ref index within the step (if applicable)
  message: string
}

/** Three-phase result — enables per-phase event log emission in Unit 2.3. */
export interface BindingValidationResult {
  /** schema_valid: schema_version present and matches "rpp.v1" (or absent = backward compat) */
  schema_valid: boolean
  /** binding_valid: all Layer A structural binding checks pass */
  binding_valid: boolean
  /** strictness_valid: all Layer B hard strictness checks pass (warnings do not affect this) */
  strictness_valid: boolean
  /** overall: schema_valid && binding_valid && strictness_valid */
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_STAGES: Array<CognitiveStep["stage"]> = [
  "interpretation",
  "reasoning",
  "decision",
  "action",
]

const RULE_ID_PATTERN = /^RUL-\d{3}$/
const METHOD_ID_PATTERN = /^[A-Z]{2,6}-\d{3}$/
const SUPPORTS_MINIMAL_LENGTH = 8

// ---------------------------------------------------------------------------
// Layer A — validateRPPBinding
// ---------------------------------------------------------------------------

export function validateRPPBinding(record: RPPRecord): BindingValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // Schema version check (informational — absent is backward compat, wrong value is schema_valid=false)
  let schema_valid = true
  if (record.schema_version !== undefined && record.schema_version !== "rpp.v1") {
    schema_valid = false
    errors.push({
      code: "MISSING_REQUIRED_STAGE",   // reuse closest structural code; schema version mismatch
      message: `schema_version "${record.schema_version}" is not recognized. Expected "rpp.v1" or absent.`,
    })
  }

  // A1: MISSING_REQUIRED_STAGE
  const presentStages = new Set(record.steps.map((s) => s.stage))
  for (const required of REQUIRED_STAGES) {
    if (!presentStages.has(required)) {
      errors.push({
        code: "MISSING_REQUIRED_STAGE",
        message: `Required stage "${required}" is missing from steps.`,
      })
    }
  }

  // A2: DUPLICATE_STEP_ID
  const seenIds = new Set<string>()
  for (const step of record.steps) {
    if (step.id !== undefined) {
      if (seenIds.has(step.id)) {
        errors.push({
          code: "DUPLICATE_STEP_ID",
          step_id: step.id,
          message: `Duplicate step id "${step.id}".`,
        })
      }
      seenIds.add(step.id)
    }
  }

  // Build id→step map for provenance checks
  const stepById = new Map<string, CognitiveStep>()
  for (const step of record.steps) {
    if (step.id) stepById.set(step.id, step)
  }

  // Per-step checks
  for (const step of record.steps) {
    const sid = step.id

    // A3: EMPTY_CONTENT
    if (!step.content || step.content.length === 0) {
      errors.push({ code: "EMPTY_CONTENT", step_id: sid, message: `Step "${sid ?? step.stage}" has empty content array.` })
    }

    // A4: EMPTY_REFERENCES
    if (!step.references || step.references.length === 0) {
      errors.push({ code: "EMPTY_REFERENCES", step_id: sid, message: `Step "${sid ?? step.stage}" has no references.` })
    }

    for (let i = 0; i < (step.references ?? []).length; i++) {
      const ref = step.references[i]!

      // A5: STEP_DERIVED_REF_FORBIDDEN
      if (ref.type === "derived") {
        errors.push({
          code: "STEP_DERIVED_REF_FORBIDDEN",
          step_id: sid,
          ref_index: i,
          message: `Step "${sid ?? step.stage}" contains a derived ref at index ${i}. DerivedRef is only valid in response.references.`,
        })
        continue
      }

      // A6: ref field validation
      _validateRefFields(ref, i, sid ?? step.stage, errors)
    }
  }

  // A7: UNTRACEABLE_RESPONSE — response must have at least one derived ref
  const derivedRefs = (record.response.references ?? []).filter((r) => r.type === "derived")
  if (derivedRefs.length === 0) {
    errors.push({
      code: "UNTRACEABLE_RESPONSE",
      message: `response.references has no derived ref. Add { type: "derived", from_steps: [...], supports: "..." }.`,
    })
  }

  // A8: EMPTY_SUPPORTS on response refs
  for (let i = 0; i < (record.response.references ?? []).length; i++) {
    const ref = record.response.references[i]!
    if ((ref.supports?.trim() ?? "").length === 0) {
      errors.push({
        code: "EMPTY_SUPPORTS",
        ref_index: i,
        message: `response.references[${i}] has empty supports field.`,
      })
    }
  }

  // A9: per derived ref — EMPTY_PROVENANCE_LINK, DANGLING_STEP_REFERENCE, UNGROUNDED_PROVENANCE_TARGET
  for (let i = 0; i < derivedRefs.length; i++) {
    const ref = derivedRefs[i]!
    if (!ref.from_steps || ref.from_steps.length === 0) {
      errors.push({ code: "EMPTY_PROVENANCE_LINK", ref_index: i, message: `DerivedRef from_steps is empty.` })
      continue
    }
    if (stepById.size === 0) continue  // no step ids — backward compat, skip resolution
    for (const stepId of ref.from_steps) {
      const target = stepById.get(stepId)
      if (!target) {
        errors.push({
          code: "DANGLING_STEP_REFERENCE",
          ref_index: i,
          message: `DerivedRef.from_steps references step id "${stepId}" which does not exist.`,
        })
      } else {
        const hasGrounded = (target.references ?? []).some(
          (r) => r.type === "evidence" || r.type === "rule" || r.type === "method"
        )
        if (!hasGrounded) {
          errors.push({
            code: "UNGROUNDED_PROVENANCE_TARGET",
            step_id: stepId,
            message: `DerivedRef.from_steps target "${stepId}" has no evidence/rule/method refs — chain terminates in an ungrounded step.`,
          })
        }
      }
    }
  }

  const binding_valid = errors.length === 0
  return {
    schema_valid,
    binding_valid,
    strictness_valid: true,   // Layer B not run — assume pass
    valid: schema_valid && binding_valid,
    errors,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Layer B — checkRPPStrictness
// ---------------------------------------------------------------------------

export function checkRPPStrictness(record: RPPRecord): BindingValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // B1 (hard): UNJUSTIFIED_DECISION — decision step must have rule or method ref
  const decisionStep = record.steps.find((s) => s.stage === "decision")
  if (decisionStep) {
    const hasRuleOrMethod = (decisionStep.references ?? []).some(
      (r) => r.type === "rule" || r.type === "method"
    )
    if (!hasRuleOrMethod) {
      errors.push({
        code: "UNJUSTIFIED_DECISION",
        step_id: decisionStep.id,
        message: `Decision step "${decisionStep.id ?? "decision"}" has no rule or method ref. Decisions must be justified by a rule or method, not evidence alone.`,
      })
    }
  }

  // B2 (hard): ACTION_NO_EVIDENCE — action step must have at least one evidence ref
  const actionStep = record.steps.find((s) => s.stage === "action")
  if (actionStep) {
    const hasEvidence = (actionStep.references ?? []).some((r) => r.type === "evidence")
    if (!hasEvidence) {
      errors.push({
        code: "ACTION_NO_EVIDENCE",
        step_id: actionStep.id,
        message: `Action step "${actionStep.id ?? "action"}" has no evidence ref. Actions must be grounded in observable reality.`,
      })
    }
  }

  // B3 (warning): RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION
  const stepById = new Map<string, CognitiveStep>()
  for (const step of record.steps) {
    if (step.id) stepById.set(step.id, step)
  }
  if (stepById.size > 0) {
    for (const ref of record.response.references ?? []) {
      if (ref.type !== "derived" || !ref.from_steps?.length) continue
      const hasDecisionOrAction = ref.from_steps.some((id) => {
        const s = stepById.get(id)
        return s?.stage === "decision" || s?.stage === "action"
      })
      if (!hasDecisionOrAction) {
        warnings.push({
          code: "RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION",
          message: `Response DerivedRef.from_steps [${ref.from_steps.join(", ")}] does not include a decision or action step. Consider tracing to decision/action for stronger provenance.`,
        })
      }
    }
  }

  // B4 (warning): SUPPORTS_MINIMAL — across all steps and response
  const allStepsAndResponse: Array<{ refs: Reference[]; context: string }> = [
    ...record.steps.map((s) => ({ refs: s.references ?? [], context: s.id ?? s.stage })),
    { refs: record.response.references ?? [], context: "response" },
  ]
  for (const { refs, context } of allStepsAndResponse) {
    for (let i = 0; i < refs.length; i++) {
      const supports = refs[i]!.supports?.trim() ?? ""
      if (supports.length > 0 && supports.length < SUPPORTS_MINIMAL_LENGTH) {
        warnings.push({
          code: "SUPPORTS_MINIMAL",
          ref_index: i,
          message: `"${context}" ref[${i}] supports field is very short (${supports.length} chars). Consider a more descriptive supports value.`,
        })
      }
    }
  }

  const strictness_valid = errors.length === 0
  return {
    schema_valid: true,       // Layer A not run — assume pass
    binding_valid: true,      // Layer A not run — assume pass
    strictness_valid,
    valid: strictness_valid,
    errors,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Combined validator (convenience)
// ---------------------------------------------------------------------------

/** Run Layer A + Layer B and merge results into a single BindingValidationResult. */
export function validateRPPFull(record: RPPRecord): BindingValidationResult {
  const layerA = validateRPPBinding(record)
  const layerB = checkRPPStrictness(record)
  return {
    schema_valid: layerA.schema_valid,
    binding_valid: layerA.binding_valid,
    strictness_valid: layerB.strictness_valid,
    valid: layerA.schema_valid && layerA.binding_valid && layerB.strictness_valid,
    errors: [...layerA.errors, ...layerB.errors],
    warnings: [...layerA.warnings, ...layerB.warnings],
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _validateRefFields(
  ref: Reference,
  refIndex: number,
  context: string,
  errors: ValidationIssue[]
): void {
  // EMPTY_SUPPORTS — all ref types
  if ((ref.supports?.trim() ?? "").length === 0) {
    errors.push({
      code: "EMPTY_SUPPORTS",
      ref_index: refIndex,
      message: `"${context}" ref[${refIndex}] has empty supports field.`,
    })
  }

  if (ref.type === "rule") {
    if (!RULE_ID_PATTERN.test(ref.rule_id ?? "")) {
      errors.push({
        code: "INVALID_RULE_ID",
        ref_index: refIndex,
        message: `"${context}" ref[${refIndex}] has invalid rule_id "${ref.rule_id}". Must match /^RUL-\\d{3}$/.`,
      })
    }
  } else if (ref.type === "method") {
    if (!METHOD_ID_PATTERN.test(ref.method_id ?? "")) {
      errors.push({
        code: "INVALID_METHOD_ID",
        ref_index: refIndex,
        message: `"${context}" ref[${refIndex}] has invalid method_id "${ref.method_id}". Must match /^[A-Z]{2,6}-\\d{3}$/.`,
      })
    }
  } else if (ref.type === "evidence") {
    if (!ref.locator?.trim()) {
      errors.push({
        code: "EMPTY_LOCATOR",
        ref_index: refIndex,
        message: `"${context}" ref[${refIndex}] evidence ref has empty locator.`,
      })
    }
  }
}
