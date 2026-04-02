/**
 * validate-type-principal.ts — validateTypePrincipal()
 *
 * Checks that a (type, principals[]) pair satisfies TYPE_PRINCIPAL_POLICY:
 *   - required: at least one required principal must be present
 *   - forbidden: no forbidden principal may be present
 *
 * Unknown type → valid (unconstrained).
 * Empty principals list is valid for types with no required entries.
 */

import { TYPE_PRINCIPAL_POLICY } from "./policy-table.js"

export interface TypePrincipalViolation {
  kind: "missing_required" | "has_forbidden"
  principal: string
  reason: string
}

export interface TypePrincipalResult {
  valid: boolean
  violations: TypePrincipalViolation[]
}

/**
 * Validate that `principals` satisfies the policy for `type`.
 *
 * @param type       The reasoning type (e.g. "root_cause_fix")
 * @param principals List of principals declared for this reasoning step
 */
export function validateTypePrincipal(
  type: string,
  principals: string[],
): TypePrincipalResult {
  const policy = TYPE_PRINCIPAL_POLICY[type]

  // Unknown type → unconstrained
  if (!policy) {
    return { valid: true, violations: [] }
  }

  const violations: TypePrincipalViolation[] = []
  const principalSet = new Set(principals)

  // Check required: at least one must be present
  if (policy.required.length > 0) {
    const hasRequired = policy.required.some((p) => principalSet.has(p))
    if (!hasRequired) {
      violations.push({
        kind: "missing_required",
        principal: policy.required.join(" | "),
        reason: `type "${type}" requires at least one of [${policy.required.join(", ")}] but none found`,
      })
    }
  }

  // Check forbidden: none may be present
  for (const p of policy.forbidden) {
    if (principalSet.has(p)) {
      violations.push({
        kind: "has_forbidden",
        principal: p,
        reason: `type "${type}" forbids principal "${p}"`,
      })
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}
