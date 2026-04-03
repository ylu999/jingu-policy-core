// CDP v1 Principal Taxonomy (p174)
export type { PrincipalCategory, PrincipalId, Principal } from "./taxonomy.js"
export {
  PRINCIPALS,
  ALL_PRINCIPAL_IDS,
  getPrincipal,
  getPrincipalsByCategory,
  isValidPrincipalId,
} from "./taxonomy.js"

// CDP v1 CognitionDeclaration schema (p174)
export type {
  Evidence,
  Claim,
  Attribution,
  CognitionPhase,
  CognitionDeclaration,
} from "./schema.js"

// CDP v1 Principal Validators (p174, p175)
export type { PrincipalValidatorError, PrincipalValidationResult } from "./validators.js"
export {
  PrincipalValidatorCode,
  REQUIRED_PRINCIPALS_BY_TYPE,
  validateEvidenceCoverage,
  validateTypePrincipalBinding,
  validateAttribution,
  validateLayerOrder,
  validateEnvironmentIndependence,
  runPrincipalValidators,
} from "./validators.js"

// CDP v1 Principal Violation Attribution (p174)
export type { PrincipalViolation } from "./failure-attribution.js"
export {
  PRINCIPAL_VIOLATION_RULES,
  attributePrincipalViolation,
} from "./failure-attribution.js"
