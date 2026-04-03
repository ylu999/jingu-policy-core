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
