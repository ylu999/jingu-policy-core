export type { PrincipalPolicy } from "./policy-table.js"
export { TYPE_PRINCIPAL_POLICY } from "./policy-table.js"
export type { TypePrincipalViolation, TypePrincipalResult } from "./validate-type-principal.js"
export { validateTypePrincipal } from "./validate-type-principal.js"

// CDP v1 taxonomy (p170)
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

// CDP v1 Declaration Validator (p171)
export type { DeclarationValidationResult, Declaration } from "./declaration-validator.js"
export {
  DeclError,
  TYPE_TO_VALIDATORS,
  validateDeclaration,
  getTypeValidatorsForDecl,
} from "./declaration-validator.js"

// CDP v1 Validator Pipeline (p172)
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

// CDP v1 Failure Attribution (p173)
export type { FailureAttribution, AttributionRule, FailureTrace } from "./types.js"
export {
  ATTRIBUTION_PRIORITY,
  ATTRIBUTION_RULES,
  attributeFailure,
  selectPrimaryAttribution,
  buildFailureTrace,
} from "./failure-attribution.js"

// CDP v1 Cognitive Policy System — principals/ (p174)
// Note: Principal from principals/ is exported as CognitivePrincipal to avoid
// collision with Principal (12-atom type) from taxonomy.js
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
