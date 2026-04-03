/**
 * validator-pipeline.ts — CDP v1 Validator Pipeline (p172)
 *
 * Responsibility boundary:
 *   - Given a validated declaration, derive the full set of validators to run
 *   - Execute validators and produce a typed ValidationResult
 *   - Convert validation errors into actionable retry hints
 *
 * Layers:
 *   L1 (type-strong):   TYPE_TO_VALIDATORS[type]  — mandatory, no override
 *   L2 (principal):     PRINCIPAL_TO_VALIDATORS[p] — additional per declared principal
 *   deriveFinalValidators = union(L1, L2), deduped
 */

import type { Principal, ValidatorName } from "./taxonomy.js"
import { TYPE_TO_VALIDATORS } from "./declaration-validator.js"

// ── ValidatorSeverity ─────────────────────────────────────────────────────────

export type ValidatorSeverity = "hard" | "semi" | "signal"

// ── ValidationErrorCode ───────────────────────────────────────────────────────

export const ValidationErrorCode = {
  // Evidence / claim layer
  MISSING_EVIDENCE_FOR_CLAIM:  "MISSING_EVIDENCE_FOR_CLAIM",
  UNTRACEABLE_REFERENCE:       "UNTRACEABLE_REFERENCE",
  UNSUPPORTED_CLAIM:           "UNSUPPORTED_CLAIM",
  // Constraint / scope layer
  CONSTRAINT_VIOLATION:        "CONSTRAINT_VIOLATION",
  SCOPE_VIOLATION:             "SCOPE_VIOLATION",
  INCONSISTENT_STATE:          "INCONSISTENT_STATE",
  // Execution layer
  EXECUTION_FAILED:            "EXECUTION_FAILED",
  DIFF_TOO_LARGE:              "DIFF_TOO_LARGE",
  // Reasoning layer
  WEAK_CAUSAL_LINK:            "WEAK_CAUSAL_LINK",
  MISSING_HYPOTHESIS_FLOW:     "MISSING_HYPOTHESIS_FLOW",
  // Coverage layer
  INCOMPLETE_COVERAGE:         "INCOMPLETE_COVERAGE",
  MISSING_ASSUMPTION:          "MISSING_ASSUMPTION",
} as const

export type ValidationErrorCode = typeof ValidationErrorCode[keyof typeof ValidationErrorCode]

// ── Core types ────────────────────────────────────────────────────────────────

export interface ValidationError {
  code:      ValidationErrorCode
  validator: ValidatorName
  severity:  ValidatorSeverity
  message:   string
}

export interface ValidationResult {
  pass:   boolean
  errors: ValidationError[]
}

export interface ValidationContext {
  output:       unknown
  evidence?:    unknown[]
  inputs?:      unknown
  execution?:   unknown
  constraints?: unknown
}

export type Validator = (ctx: ValidationContext) => ValidationResult

// ── PRINCIPAL_TO_VALIDATORS ───────────────────────────────────────────────────
//
// Maps each of the 12 CDP principal atoms to:
//   - validators: ValidatorName[] — additional validators triggered by this principal
//   - severity:   ValidatorSeverity — default severity when these validators fire
//
// Hard: principal claims that are structural guarantees (evidence, scope, execution)
// Semi: reasoning-quality principals (causality, hypothesis, completeness, assumption)
// Signal: risk_awareness is informational only — no validators added

export const PRINCIPAL_TO_VALIDATORS: Record<
  Principal,
  { validators: ValidatorName[]; severity: ValidatorSeverity }
> = {
  // ── Hard principals ──────────────────────────────────────────────────────
  evidence_based:      { validators: ["evidence_coverage", "no_unsupported_claim"], severity: "hard"   },
  no_hallucination:    { validators: ["no_unsupported_claim"],                       severity: "hard"   },
  constraint_awareness:{ validators: ["constraint_check"],                           severity: "hard"   },
  scope_control:       { validators: ["scope_check"],                                severity: "hard"   },
  consistency_check:   { validators: ["consistency_check"],                          severity: "hard"   },
  execution_first:     { validators: ["execution_check"],                            severity: "hard"   },
  minimal_change:      { validators: ["diff_size_check"],                            severity: "hard"   },
  // ── Semi principals ──────────────────────────────────────────────────────
  causality:           { validators: ["causal_link_check"],                          severity: "semi"   },
  hypothesis_testing:  { validators: ["coverage_check"],                             severity: "semi"   },
  completeness:        { validators: ["coverage_check"],                             severity: "semi"   },
  explicit_assumption: { validators: ["constraint_check"],                           severity: "semi"   },
  // ── Signal principals ────────────────────────────────────────────────────
  risk_awareness:      { validators: [],                                             severity: "signal" },
}

// ── deriveValidatorsFromPrincipals ────────────────────────────────────────────

export function deriveValidatorsFromPrincipals(
  principals: Principal[]
): ValidatorName[] {
  const seen = new Set<ValidatorName>()
  for (const p of principals) {
    for (const v of PRINCIPAL_TO_VALIDATORS[p].validators) {
      seen.add(v)
    }
  }
  return [...seen]
}

// ── deriveFinalValidators ─────────────────────────────────────────────────────
//
// Returns the full deduped union of:
//   L1: TYPE_TO_VALIDATORS[type]           — mandatory type-strong validators
//   L2: deriveValidatorsFromPrincipals()   — additional principal-triggered validators

export function deriveFinalValidators(
  type: string,
  principals: Principal[]
): ValidatorName[] {
  const typeValidators = TYPE_TO_VALIDATORS[type] ?? []
  const principalValidators = deriveValidatorsFromPrincipals(principals)

  const seen = new Set<ValidatorName>()
  for (const v of typeValidators)      seen.add(v)
  for (const v of principalValidators) seen.add(v)
  return [...seen]
}

// ── runValidation ─────────────────────────────────────────────────────────────
//
// Runs all derived validators for the declaration.
// Hard failures → pass: false
// Semi/signal failures → collected in errors but do NOT set pass: false

export function runValidation(
  declaration: { type: string; principals: Principal[] },
  ctx: ValidationContext,
  registry: Record<ValidatorName, Validator>
): ValidationResult {
  const validators = deriveFinalValidators(declaration.type, declaration.principals)
  const allErrors: ValidationError[] = []

  for (const validatorName of validators) {
    const fn = registry[validatorName]
    if (!fn) continue
    const result = fn(ctx)
    if (!result.pass) {
      allErrors.push(...result.errors)
    }
  }

  const hasHardFailure = allErrors.some(e => e.severity === "hard")

  return {
    pass:   !hasHardFailure,
    errors: allErrors,
  }
}

// ── buildRetryHint ────────────────────────────────────────────────────────────
//
// Converts ValidationErrors into actionable correction hints.
// Each error code maps to a precise instruction the LLM can act on.

const RETRY_HINT: Record<ValidationErrorCode, string> = {
  MISSING_EVIDENCE_FOR_CLAIM:
    "Each claim must cite a specific, traceable evidence source. Add locator references (file:line, log excerpt, test output) for every assertion.",
  UNTRACEABLE_REFERENCE:
    "All references must be resolvable. Replace abstract or ambiguous references with concrete locators that can be independently verified.",
  UNSUPPORTED_CLAIM:
    "Remove or qualify claims that go beyond the available evidence. Every conclusion must be grounded in cited observations.",
  CONSTRAINT_VIOLATION:
    "Your output violates a declared system constraint. Re-check the applicable constraint definitions and revise the output to comply.",
  SCOPE_VIOLATION:
    "Changes exceed the declared scope boundary. Restrict modifications to files and components explicitly in scope for this task.",
  INCONSISTENT_STATE:
    "The output contains internally inconsistent elements. Resolve conflicting assertions before proceeding.",
  EXECUTION_FAILED:
    "The execution step did not produce a valid result. Check the execution preconditions and ensure the required environment state is met.",
  DIFF_TOO_LARGE:
    "The change diff exceeds the allowed size. Split into smaller, focused changes; each change should address a single concern.",
  WEAK_CAUSAL_LINK:
    "The causal chain between evidence and conclusion is incomplete. Explicitly state each intermediate step in the reasoning chain.",
  MISSING_HYPOTHESIS_FLOW:
    "Diagnostic reasoning requires a hypothesis → test → conclude flow. State the hypothesis explicitly before presenting evidence.",
  INCOMPLETE_COVERAGE:
    "Not all required aspects are addressed. Review the completeness checklist and ensure every required dimension is covered.",
  MISSING_ASSUMPTION:
    "Implicit assumptions must be declared explicitly. List all assumptions and their justifications before drawing conclusions.",
}

export function buildRetryHint(errors: ValidationError[]): string[] {
  const seen = new Set<ValidationErrorCode>()
  const hints: string[] = []
  for (const err of errors) {
    if (!seen.has(err.code)) {
      seen.add(err.code)
      hints.push(RETRY_HINT[err.code])
    }
  }
  return hints
}

// ── CDPValidationPipelineResult ───────────────────────────────────────────────
//
// The stable interface exposed to p173 (failure attribution) and p174 (policy).
// p173/p174 consume this — they do NOT call runValidation directly.

export interface NormalizedDeclaration {
  type:       string
  subType?:   string
  principals: Principal[]
  validators: ValidatorName[]
}

export interface CDPValidationPipelineResult {
  admitted:               boolean
  stage:                  "declaration_validator"
  normalizedDeclaration?: NormalizedDeclaration
  issues:                 ValidationError[]
  failureSummary?: {
    primaryCode:    ValidationErrorCode
    secondaryCodes: ValidationErrorCode[]
  }
}

// ── buildPipelineResult ───────────────────────────────────────────────────────
//
// Converts runValidation output into the stable CDPValidationPipelineResult.

export function buildPipelineResult(
  declaration: { type: string; subType?: string; principals: Principal[] },
  validationResult: ValidationResult
): CDPValidationPipelineResult {
  const validators = deriveFinalValidators(declaration.type, declaration.principals)

  if (validationResult.pass) {
    return {
      admitted: true,
      stage:    "declaration_validator",
      normalizedDeclaration: {
        type:       declaration.type,
        subType:    declaration.subType,
        principals: declaration.principals,
        validators,
      },
      issues: validationResult.errors,
    }
  }

  const hardErrors  = validationResult.errors.filter(e => e.severity === "hard")
  const otherErrors = validationResult.errors.filter(e => e.severity !== "hard")

  const primaryCode    = hardErrors[0]?.code ?? validationResult.errors[0].code
  const secondaryCodes = [...hardErrors.slice(1), ...otherErrors]
    .map(e => e.code)
    .filter((c, i, arr) => arr.indexOf(c) === i && c !== primaryCode)

  return {
    admitted: false,
    stage:    "declaration_validator",
    issues:   validationResult.errors,
    failureSummary: {
      primaryCode,
      secondaryCodes,
    },
  }
}
