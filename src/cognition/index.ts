/**
 * src/cognition/index.ts — CDP v1 public API barrel
 *
 * Naming boundary (two layers, two naming conventions):
 *
 *   CDP KERNEL LAYER (p166/p170–p173)
 *     Declaration-level types: Principal (12-atom union), TypePolicy, ValidatorName
 *     Validation: validateDeclaration, DeclError, TYPE_TO_VALIDATORS
 *     Pipeline:   CDPValidationPipelineResult, runValidation, buildPipelineResult
 *     Attribution: FailureAttribution, FailureTrace, buildFailureTrace
 *
 *   POLICY LAYER (p174)
 *     Enriched principal objects: CognitivePrincipal (alias for principals/Principal)
 *     Declaration schema:  CognitionDeclaration, CognitionAttribution
 *     Validators: validateEvidenceCoverage, validateTypePrincipalBinding, etc.
 *     Violation attribution: PrincipalViolation, attributePrincipalViolation
 *
 * Alias rationale:
 *   - "Principal" (kernel) = string union of 12 CDP atom identifiers
 *   - "CognitivePrincipal" (policy) = rich interface with description/evidence/violation fields
 *   - "Attribution" (schema) = re-exported as "CognitionAttribution" to avoid collision
 *     with p173 "FailureAttribution"
 */

// ── Pre-CDP type-principal policy (p166) ──────────────────────────────────────
export type { PrincipalPolicy } from "./policy-table.js"
export { TYPE_PRINCIPAL_POLICY } from "./policy-table.js"
export type { TypePrincipalViolation, TypePrincipalResult } from "./validate-type-principal.js"
export { validateTypePrincipal } from "./validate-type-principal.js"

// ── CDP KERNEL LAYER ──────────────────────────────────────────────────────────

// Taxonomy (p170): 9 types, 12 principal atoms, TypePolicy
// "Principal" here = string union: "evidence_based" | "no_hallucination" | ...
export type { Principal, TypePolicy, ValidatorName } from "./taxonomy.js"
export {
  ALL_PRINCIPALS,
  ALL_TYPES,
  TYPE_POLICIES,
  getTypePolicy,
  isValidPrincipal,
  isValidSubType,
  getTypeValidators,
} from "./taxonomy.js"

// Declaration Validator (p171): validateDeclaration, DeclError, TYPE_TO_VALIDATORS
export type { DeclarationValidationResult, Declaration } from "./declaration-validator.js"
export {
  DeclError,
  TYPE_TO_VALIDATORS,
  validateDeclaration,
  getTypeValidatorsForDecl,
} from "./declaration-validator.js"

// Validator Pipeline (p172): deriveFinalValidators, runValidation, CDPValidationPipelineResult
export type {
  ValidatorSeverity,
  ValidationError,
  ValidationResult,
  ValidationContext,
  Validator,
  NormalizedDeclaration,
  CDPValidationPipelineResult,
} from "./validator-pipeline.js"
export {
  ValidationErrorCode,
  PRINCIPAL_TO_VALIDATORS,
  deriveValidatorsFromPrincipals,
  deriveFinalValidators,
  runValidation,
  buildRetryHint,
  buildPipelineResult,
} from "./validator-pipeline.js"

// Failure Attribution (p173): attributeFailure, buildFailureTrace, FailureTrace
export type { FailureAttribution, AttributionRule, FailureTrace } from "./types.js"
export {
  ATTRIBUTION_PRIORITY,
  ATTRIBUTION_RULES,
  attributeFailure,
  selectPrimaryAttribution,
  buildFailureTrace,
} from "./failure-attribution.js"

// ── POLICY LAYER ──────────────────────────────────────────────────────────────

// Cognitive Policy System (p174): 17 principals, CognitionDeclaration, 4 validators
//
// Aliased exports to avoid naming collision with CDP kernel:
//   Principal  (principals/taxonomy)  → CognitivePrincipal
//   Attribution (principals/schema)   → CognitionAttribution
export type {
  PrincipalCategory,
  PrincipalId,
  Principal as CognitivePrincipal,
  Evidence,
  Claim,
  Attribution as CognitionAttribution,
  CognitionPhase,
  CognitionDeclaration,
  PrincipalValidatorError,
  PrincipalValidationResult,
  PrincipalViolation,
} from "./principals/index.js"
export {
  PRINCIPALS,
  ALL_PRINCIPAL_IDS,
  getPrincipal,
  getPrincipalsByCategory,
  isValidPrincipalId,
  PrincipalValidatorCode,
  REQUIRED_PRINCIPALS_BY_TYPE,
  validateEvidenceCoverage,
  validateTypePrincipalBinding,
  validateAttribution,
  validateLayerOrder,
  runPrincipalValidators,
  PRINCIPAL_VIOLATION_RULES,
  attributePrincipalViolation,
} from "./principals/index.js"
