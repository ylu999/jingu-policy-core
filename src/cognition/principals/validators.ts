/**
 * validators.ts — CDP v1 Principal Validators (p174, p175)
 *
 * Five validators that operate on CognitionDeclaration:
 *   1. validateEvidenceCoverage — every claim must have supported_by.length > 0
 *   2. validateTypePrincipalBinding — required principals per type must be present
 *   3. validateAttribution — attribution must be backed by evidence
 *   4. validateLayerOrder — P_DEBUG_LAYER_ORDER requires ≥2 distinct layers in evidence
 *   5. validateEnvironmentIndependence — P_DEBUG_ENV_INDEPENDENCE requires env validation evidence
 *      (p175: grounded in CF-ENV-001)
 *
 * These are semantic checks on admitted declarations — they do NOT re-run declaration
 * validation (p171) and do NOT modify or attribute errors (p173).
 */

import type { CognitionDeclaration } from "./schema.js"
import type { PrincipalId } from "./taxonomy.js"

// ── Validator error codes ─────────────────────────────────────────────────────

export const PrincipalValidatorCode = {
  UNSUPPORTED_CLAIM:          "UNSUPPORTED_CLAIM",
  MISSING_REQUIRED_PRINCIPAL: "MISSING_REQUIRED_PRINCIPAL",
  UNSUPPORTED_ATTRIBUTION:    "UNSUPPORTED_ATTRIBUTION",
  INSUFFICIENT_LAYER_CHECK:   "INSUFFICIENT_LAYER_CHECK",
  ENV_LEAKAGE_HARDCODE_PATH:  "ENV_LEAKAGE_HARDCODE_PATH",
} as const

export type PrincipalValidatorCode = typeof PrincipalValidatorCode[keyof typeof PrincipalValidatorCode]

// ── PrincipalValidatorError ───────────────────────────────────────────────────

export interface PrincipalValidatorError {
  code:       PrincipalValidatorCode
  message:    string
  claimIndex?: number
}

export interface PrincipalValidationResult {
  pass:   boolean
  errors: PrincipalValidatorError[]
}

// ── REQUIRED_PRINCIPALS_BY_TYPE ───────────────────────────────────────────────
//
// Policy table: CDP type string → required principal IDs.
// Violations are POLICY errors, not declaration errors (p171 owns the hard gate).

export const REQUIRED_PRINCIPALS_BY_TYPE: Record<string, PrincipalId[]> = {
  debugging: [
    "P_DEBUG_ROOT_CAUSE_ISOLATION",
    "P_DEBUG_VERIFY_BEFORE_ATTRIBUTION",
  ],
  reasoning: [
    "P_REASON_EVIDENCE_GROUNDED",
  ],
  design: [
    "P_DESIGN_VERIFY_BEFORE_COMMIT",
    "P_DESIGN_CONSTRAINT_AWARE",
  ],
}

// ── Validator 1: validateEvidenceCoverage ─────────────────────────────────────

export function validateEvidenceCoverage(
  decl: CognitionDeclaration
): PrincipalValidationResult {
  const errors: PrincipalValidatorError[] = []

  for (let i = 0; i < decl.claims.length; i++) {
    const claim = decl.claims[i]
    if (claim.supported_by.length === 0) {
      errors.push({
        code:       PrincipalValidatorCode.UNSUPPORTED_CLAIM,
        message:    `Claim [${i}] "${claim.statement.slice(0, 60)}..." has no evidence references`,
        claimIndex: i,
      })
    }
  }

  return { pass: errors.length === 0, errors }
}

// ── Validator 2: validateTypePrincipalBinding ─────────────────────────────────

export function validateTypePrincipalBinding(
  decl: CognitionDeclaration
): PrincipalValidationResult {
  const required = REQUIRED_PRINCIPALS_BY_TYPE[decl.type] ?? []
  const declared = new Set(decl.principals_used)
  const errors: PrincipalValidatorError[] = []

  for (const req of required) {
    if (!declared.has(req)) {
      errors.push({
        code:    PrincipalValidatorCode.MISSING_REQUIRED_PRINCIPAL,
        message: `Type "${decl.type}" requires principal "${req}" but it was not declared in principals_used`,
      })
    }
  }

  return { pass: errors.length === 0, errors }
}

// ── Validator 3: validateAttribution ─────────────────────────────────────────

export function validateAttribution(
  decl: CognitionDeclaration
): PrincipalValidationResult {
  if (!decl.attribution) {
    return { pass: true, errors: [] }
  }

  if (decl.evidence.length === 0) {
    return {
      pass:   false,
      errors: [{
        code:    PrincipalValidatorCode.UNSUPPORTED_ATTRIBUTION,
        message: `Attribution to "${decl.attribution.target}" is present but evidence[] is empty — attribution must be backed by at least one evidence item`,
      }],
    }
  }

  return { pass: true, errors: [] }
}

// ── Validator 4: validateLayerOrder ──────────────────────────────────────────
//
// Only fires when P_DEBUG_LAYER_ORDER is in principals_used.
// Evidence items must collectively reference at least 2 distinct system layers.
// Heuristic: layer keywords in evidence content.

const LAYER_KEYWORDS: Record<string, string> = {
  infra:        "infra",
  infrastructure: "infra",
  network:      "infra",
  wiring:       "wiring",
  config:       "wiring",
  configuration: "wiring",
  data:         "data",
  database:     "data",
  schema:       "data",
  model:        "model",
  llm:          "model",
  prompt:       "model",
  api:          "model",
}

function detectLayers(evidenceItems: CognitionDeclaration["evidence"]): Set<string> {
  const layers = new Set<string>()
  for (const ev of evidenceItems) {
    const lower = ev.content.toLowerCase()
    for (const [keyword, layer] of Object.entries(LAYER_KEYWORDS)) {
      if (lower.includes(keyword)) {
        layers.add(layer)
      }
    }
  }
  return layers
}

export function validateLayerOrder(
  decl: CognitionDeclaration
): PrincipalValidationResult {
  if (!decl.principals_used.includes("P_DEBUG_LAYER_ORDER")) {
    return { pass: true, errors: [] }
  }

  const layers = detectLayers(decl.evidence)
  if (layers.size < 2) {
    return {
      pass:   false,
      errors: [{
        code:    PrincipalValidatorCode.INSUFFICIENT_LAYER_CHECK,
        message: `P_DEBUG_LAYER_ORDER declared but evidence references only ${layers.size} distinct system layer(s). At least 2 layers (infra/wiring/data/model) must be present.`,
      }],
    }
  }

  return { pass: true, errors: [] }
}

// ── Validator 5: validateEnvironmentIndependence ──────────────────────────────
//
// Only fires when P_DEBUG_ENV_INDEPENDENCE is in principals_used.
// Evidence must include at least one item containing env validation keywords.
// Grounded in CF-ENV-001: diagnosis stopped at symptom without checking environment.
//
// Violation signals: absolute paths (/root/, /home/, /Users/), assumed env vars
// (HOME=, USER=, PATH=), tool assumptions (node_modules assumed present).

const ENV_VALIDATION_KEYWORDS = [
  "env check",
  "environment check",
  "smoke test",
  "smoke_test",
  "preflight",
  "activation proof",
  "env_validation",
  "environment validation",
  "verified on",
  "confirmed on",
  "tested on",
]

const LOCAL_PATH_PATTERNS = [
  /\/root\//,
  /\/home\//,
  /\/Users\//,
  /node_modules assumed/,
  /HOME assumed/,
  /PATH assumed/,
]

export function validateEnvironmentIndependence(
  decl: CognitionDeclaration
): PrincipalValidationResult {
  if (!decl.principals_used.includes("P_DEBUG_ENV_INDEPENDENCE")) {
    return { pass: true, errors: [] }
  }

  // Check: must have env validation evidence
  const hasEnvValidation = decl.evidence.some(ev => {
    const lower = ev.content.toLowerCase()
    return ENV_VALIDATION_KEYWORDS.some(kw => lower.includes(kw))
  })

  if (!hasEnvValidation) {
    return {
      pass:   false,
      errors: [{
        code:    PrincipalValidatorCode.ENV_LEAKAGE_HARDCODE_PATH,
        message: `P_DEBUG_ENV_INDEPENDENCE declared but no environment validation evidence found. ` +
                 `Evidence must include env check, smoke test, preflight, or activation proof output. ` +
                 `(CF-ENV-001: diagnosis must verify environment, not assume it)`,
      }],
    }
  }

  // Check: evidence must not contain local path leakage
  const leakedPaths: string[] = []
  for (const ev of decl.evidence) {
    for (const pattern of LOCAL_PATH_PATTERNS) {
      if (pattern.test(ev.content)) {
        leakedPaths.push(ev.content.slice(0, 80))
        break
      }
    }
  }

  if (leakedPaths.length > 0) {
    return {
      pass:   false,
      errors: [{
        code:    PrincipalValidatorCode.ENV_LEAKAGE_HARDCODE_PATH,
        message: `P_DEBUG_ENV_INDEPENDENCE declared but evidence contains local path leakage: ` +
                 `"${leakedPaths[0]}..." — hardcoded paths violate environment independence`,
      }],
    }
  }

  return { pass: true, errors: [] }
}

// ── runPrincipalValidators ────────────────────────────────────────────────────
//
// Convenience: runs all 5 validators and merges results.

export function runPrincipalValidators(
  decl: CognitionDeclaration
): PrincipalValidationResult {
  const results = [
    validateEvidenceCoverage(decl),
    validateTypePrincipalBinding(decl),
    validateAttribution(decl),
    validateLayerOrder(decl),
    validateEnvironmentIndependence(decl),
  ]

  const allErrors = results.flatMap(r => r.errors)
  return {
    pass:   allErrors.length === 0,
    errors: allErrors,
  }
}
