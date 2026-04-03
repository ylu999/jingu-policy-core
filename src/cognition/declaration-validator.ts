/**
 * declaration-validator.ts — CDP v1 Declaration Validator
 *
 * Validates a cognition declaration {type, subType?, principals[]} against
 * the TYPE_POLICIES table from taxonomy.ts.
 *
 * Responsibility boundary (p171):
 *   - Is the declaration structurally and policy-conformant?
 *   - Does NOT judge reasoning quality or semantic correctness.
 *
 * TYPE_TO_VALIDATORS: strong binding — validators that run for a type
 * regardless of what principals the LLM declared. Safety layer.
 */

import {
  type TypePolicy,
  type ValidatorName,
  isValidPrincipal,
  isValidSubType,
  TYPE_POLICIES,
} from "./taxonomy.js"

// ── DeclError enum ────────────────────────────────────────────────────────────

export const DeclError = {
  INVALID_TYPE: "INVALID_TYPE",
  INVALID_SUBTYPE: "INVALID_SUBTYPE",
  MISSING_REQUIRED_PRINCIPAL: "MISSING_REQUIRED_PRINCIPAL",
  FORBIDDEN_PRINCIPAL_USED: "FORBIDDEN_PRINCIPAL_USED",
  UNKNOWN_PRINCIPAL: "UNKNOWN_PRINCIPAL",
  TYPE_SUBTYPE_MISMATCH: "TYPE_SUBTYPE_MISMATCH",
} as const

export type DeclError = typeof DeclError[keyof typeof DeclError]

// ── Result type ───────────────────────────────────────────────────────────────

export interface DeclarationValidationResult {
  valid: boolean
  errors: DeclError[]
  errorDetails: string[]
}

// ── TYPE_TO_VALIDATORS — strong binding (9 types) ────────────────────────────
//
// These validators run regardless of what principals the LLM declared.
// Derived from TYPE_POLICIES[type].typeValidators in taxonomy.ts.
// Kept here as an explicit, auditable table so p172+ can import it directly.

export const TYPE_TO_VALIDATORS: Record<string, ValidatorName[]> = {
  understanding: ["constraint_check"],
  observation:   ["evidence_coverage", "no_unsupported_claim"],
  analysis:      ["consistency_check"],
  diagnosis:     ["evidence_coverage", "no_unsupported_claim", "causal_link_check"],
  decision:      ["constraint_check"],
  design:        ["constraint_check", "coverage_check"],
  planning:      ["coverage_check", "consistency_check"],
  execution:     ["scope_check", "execution_check", "diff_size_check"],
  validation:    ["execution_check", "consistency_check"],
}

// ── validateDeclaration ───────────────────────────────────────────────────────

export interface Declaration {
  type: string
  subType?: string
  principals: string[]
}

export function validateDeclaration(
  decl: Declaration,
  policies: Record<string, TypePolicy> = TYPE_POLICIES
): DeclarationValidationResult {
  const errors: DeclError[] = []
  const errorDetails: string[] = []

  const policy = policies[decl.type]

  // 1. Unknown type
  if (!policy) {
    errors.push(DeclError.INVALID_TYPE)
    errorDetails.push(`Unknown type "${decl.type}". Valid types: ${Object.keys(policies).join(", ")}`)
    // Cannot proceed with type-dependent checks
    return { valid: false, errors, errorDetails }
  }

  // 2. subType validation
  if (decl.subType !== undefined) {
    if (!isValidSubType(decl.type, decl.subType)) {
      // Distinguish between: subType exists but not in this type (MISMATCH)
      // vs subType is not in ANY type's list (INVALID_SUBTYPE)
      const allSubTypes = policy.subTypes
      if (allSubTypes.length > 0) {
        errors.push(DeclError.TYPE_SUBTYPE_MISMATCH)
        errorDetails.push(
          `SubType "${decl.subType}" is not valid for type "${decl.type}". ` +
          `Valid subtypes: ${allSubTypes.join(", ")}`
        )
      } else {
        errors.push(DeclError.INVALID_SUBTYPE)
        errorDetails.push(`Type "${decl.type}" does not define any subtypes but got "${decl.subType}"`)
      }
    }
  }

  // 3. Principal atom validity
  for (const p of decl.principals) {
    if (!isValidPrincipal(p)) {
      errors.push(DeclError.UNKNOWN_PRINCIPAL)
      errorDetails.push(`Unknown principal "${p}". Must be one of the 12 CDP principal atoms`)
    }
  }

  // 4. Forbidden principal check
  const forbidden = new Set(policy.forbiddenPrincipals ?? [])
  for (const p of decl.principals) {
    if (forbidden.has(p as never)) {
      errors.push(DeclError.FORBIDDEN_PRINCIPAL_USED)
      errorDetails.push(`Principal "${p}" is forbidden for type "${decl.type}"`)
    }
  }

  // 5. Required principal check (at least one from requiredPrincipals must be declared)
  const declaredSet = new Set(decl.principals)
  for (const required of policy.requiredPrincipals) {
    if (!declaredSet.has(required)) {
      errors.push(DeclError.MISSING_REQUIRED_PRINCIPAL)
      errorDetails.push(
        `Type "${decl.type}" requires principal "${required}" but it was not declared`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    errorDetails,
  }
}

// ── getRequiredValidators ─────────────────────────────────────────────────────

/**
 * Returns the full set of validators that must run for a declaration.
 * Union of type-bound validators (TYPE_TO_VALIDATORS) and principal-bound
 * validators derived from the declared principals.
 *
 * Used by p172 (validator pipeline) as input to deriveFinalValidators().
 */
export function getTypeValidatorsForDecl(decl: Declaration): ValidatorName[] {
  return TYPE_TO_VALIDATORS[decl.type] ?? []
}
