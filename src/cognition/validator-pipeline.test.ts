import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import {
  PRINCIPAL_TO_VALIDATORS,
  ValidationErrorCode,
  deriveValidatorsFromPrincipals,
  deriveFinalValidators,
  runValidation,
  buildRetryHint,
  buildPipelineResult,
} from "./validator-pipeline.js"
import type {
  ValidationContext,
  ValidationError,
  Validator,
} from "./validator-pipeline.js"
import type { ValidatorName } from "./taxonomy.js"

// ── PRINCIPAL_TO_VALIDATORS structural invariants ─────────────────────────────

describe("PRINCIPAL_TO_VALIDATORS — structural invariants", () => {
  it("has exactly 12 principals", () => {
    assert.strictEqual(Object.keys(PRINCIPAL_TO_VALIDATORS).length, 12)
  })

  it("hard principals include evidence_based, scope_control, execution_first, minimal_change", () => {
    const hardPrincipals = ["evidence_based", "scope_control", "execution_first", "minimal_change"] as const
    for (const p of hardPrincipals) {
      assert.strictEqual(PRINCIPAL_TO_VALIDATORS[p].severity, "hard", `${p} should be hard`)
    }
  })

  it("semi principals include causality, hypothesis_testing, completeness, explicit_assumption", () => {
    const semiPrincipals = ["causality", "hypothesis_testing", "completeness", "explicit_assumption"] as const
    for (const p of semiPrincipals) {
      assert.strictEqual(PRINCIPAL_TO_VALIDATORS[p].severity, "semi", `${p} should be semi`)
    }
  })

  it("risk_awareness is signal with empty validators", () => {
    assert.strictEqual(PRINCIPAL_TO_VALIDATORS.risk_awareness.severity, "signal")
    assert.deepStrictEqual(PRINCIPAL_TO_VALIDATORS.risk_awareness.validators, [])
  })
})

// ── deriveValidatorsFromPrincipals ────────────────────────────────────────────

describe("deriveValidatorsFromPrincipals", () => {
  it("evidence_based → evidence_coverage + no_unsupported_claim", () => {
    const result = deriveValidatorsFromPrincipals(["evidence_based"])
    assert.ok(result.includes("evidence_coverage"))
    assert.ok(result.includes("no_unsupported_claim"))
  })

  it("risk_awareness → empty (no validators)", () => {
    const result = deriveValidatorsFromPrincipals(["risk_awareness"])
    assert.deepStrictEqual(result, [])
  })

  it("deduplicates when multiple principals share a validator", () => {
    // causality → causal_link_check, completeness → coverage_check, hypothesis_testing → coverage_check
    const result = deriveValidatorsFromPrincipals(["completeness", "hypothesis_testing"])
    const coverageCount = result.filter(v => v === "coverage_check").length
    assert.strictEqual(coverageCount, 1, "coverage_check must not be duplicated")
  })
})

// ── deriveFinalValidators ─────────────────────────────────────────────────────

describe("deriveFinalValidators", () => {
  it("diagnosis with no principals → includes all 3 type validators", () => {
    const result = deriveFinalValidators("diagnosis", [])
    assert.ok(result.includes("evidence_coverage"), "evidence_coverage required")
    assert.ok(result.includes("no_unsupported_claim"), "no_unsupported_claim required")
    assert.ok(result.includes("causal_link_check"), "causal_link_check required")
  })

  it("diagnosis + evidence_based does not double-add evidence_coverage", () => {
    const result = deriveFinalValidators("diagnosis", ["evidence_based"])
    const count = result.filter(v => v === "evidence_coverage").length
    assert.strictEqual(count, 1, "evidence_coverage must appear exactly once")
  })

  it("execution + scope_control does not double-add scope_check", () => {
    const result = deriveFinalValidators("execution", ["scope_control"])
    const count = result.filter(v => v === "scope_check").length
    assert.strictEqual(count, 1, "scope_check must appear exactly once")
  })

  it("analysis + causality adds causal_link_check to type validators", () => {
    const result = deriveFinalValidators("analysis", ["causality"])
    assert.ok(result.includes("consistency_check"), "consistency_check from type")
    assert.ok(result.includes("causal_link_check"), "causal_link_check from principal")
  })

  it("unknown type with principals returns only principal validators", () => {
    const result = deriveFinalValidators("nonexistent_type", ["evidence_based"])
    assert.ok(result.includes("evidence_coverage"))
    assert.ok(result.includes("no_unsupported_claim"))
  })
})

// ── runValidation ─────────────────────────────────────────────────────────────

const mockCtx: ValidationContext = { output: "test" }

function makeHardFailValidator(validatorName: ValidatorName): Validator {
  return (_ctx) => ({
    pass: false,
    errors: [{
      code:      ValidationErrorCode.SCOPE_VIOLATION,
      validator: validatorName,
      severity:  "hard",
      message:   "scope exceeded",
    }],
  })
}

function makePassValidator(): Validator {
  return (_ctx) => ({ pass: true, errors: [] })
}

function makeSemiFailValidator(validatorName: ValidatorName): Validator {
  return (_ctx) => ({
    pass: false,
    errors: [{
      code:      ValidationErrorCode.WEAK_CAUSAL_LINK,
      validator: validatorName,
      severity:  "semi",
      message:   "causal link weak",
    }],
  })
}

describe("runValidation", () => {
  it("all validators pass → ValidationResult.pass = true", () => {
    const registry: Record<ValidatorName, Validator> = {
      scope_check: makePassValidator(),
    } as Record<ValidatorName, Validator>

    const result = runValidation(
      { type: "execution", principals: ["scope_control", "minimal_change"] },
      mockCtx,
      registry
    )
    assert.strictEqual(result.pass, true)
    assert.strictEqual(result.errors.length, 0)
  })

  it("hard validator failure → pass: false", () => {
    const registry: Record<ValidatorName, Validator> = {
      scope_check:    makeHardFailValidator("scope_check"),
      execution_check: makePassValidator(),
      diff_size_check: makePassValidator(),
    } as Record<ValidatorName, Validator>

    const result = runValidation(
      { type: "execution", principals: ["scope_control", "minimal_change"] },
      mockCtx,
      registry
    )
    assert.strictEqual(result.pass, false)
    assert.ok(result.errors.some(e => e.code === ValidationErrorCode.SCOPE_VIOLATION))
  })

  it("semi validator failure alone → pass: true (not hard)", () => {
    const registry: Record<ValidatorName, Validator> = {
      causal_link_check: makeSemiFailValidator("causal_link_check"),
    } as Record<ValidatorName, Validator>

    const result = runValidation(
      { type: "analysis", principals: ["causality"] },
      mockCtx,
      registry
    )
    // analysis type-strong = consistency_check (not in registry → skipped)
    // causality → causal_link_check semi fail
    assert.strictEqual(result.pass, true, "semi failures alone must not block")
    assert.ok(result.errors.some(e => e.severity === "semi"))
  })

  it("missing validator in registry is skipped gracefully", () => {
    const registry = {} as Record<ValidatorName, Validator>
    const result = runValidation(
      { type: "execution", principals: ["scope_control", "minimal_change"] },
      mockCtx,
      registry
    )
    assert.strictEqual(result.pass, true)
    assert.strictEqual(result.errors.length, 0)
  })
})

// ── buildRetryHint ────────────────────────────────────────────────────────────

describe("buildRetryHint", () => {
  it("returns non-empty hint for MISSING_EVIDENCE_FOR_CLAIM", () => {
    const errors: ValidationError[] = [{
      code:      ValidationErrorCode.MISSING_EVIDENCE_FOR_CLAIM,
      validator: "evidence_coverage",
      severity:  "hard",
      message:   "no evidence",
    }]
    const hints = buildRetryHint(errors)
    assert.strictEqual(hints.length, 1)
    assert.ok(hints[0].length > 0)
    assert.ok(hints[0].toLowerCase().includes("evidence"))
  })

  it("deduplicates hints for repeated error codes", () => {
    const errors: ValidationError[] = [
      { code: ValidationErrorCode.SCOPE_VIOLATION, validator: "scope_check",    severity: "hard", message: "a" },
      { code: ValidationErrorCode.SCOPE_VIOLATION, validator: "diff_size_check", severity: "hard", message: "b" },
    ]
    const hints = buildRetryHint(errors)
    assert.strictEqual(hints.length, 1)
  })

  it("returns multiple hints for distinct error codes", () => {
    const errors: ValidationError[] = [
      { code: ValidationErrorCode.SCOPE_VIOLATION,         validator: "scope_check",    severity: "hard", message: "a" },
      { code: ValidationErrorCode.MISSING_EVIDENCE_FOR_CLAIM, validator: "evidence_coverage", severity: "hard", message: "b" },
    ]
    const hints = buildRetryHint(errors)
    assert.strictEqual(hints.length, 2)
  })

  it("returns empty array for empty errors", () => {
    const hints = buildRetryHint([])
    assert.deepStrictEqual(hints, [])
  })
})

// ── buildPipelineResult ───────────────────────────────────────────────────────

describe("buildPipelineResult", () => {
  it("admitted=true when validation passes", () => {
    const result = buildPipelineResult(
      { type: "execution", subType: "code_change", principals: ["scope_control", "minimal_change"] },
      { pass: true, errors: [] }
    )
    assert.strictEqual(result.admitted, true)
    assert.strictEqual(result.stage, "declaration_validator")
    assert.ok(result.normalizedDeclaration)
    assert.strictEqual(result.normalizedDeclaration!.type, "execution")
    assert.strictEqual(result.normalizedDeclaration!.subType, "code_change")
    assert.ok(result.normalizedDeclaration!.validators.length > 0)
    assert.strictEqual(result.failureSummary, undefined)
  })

  it("admitted=false when hard failure present", () => {
    const errors: ValidationError[] = [
      { code: ValidationErrorCode.SCOPE_VIOLATION, validator: "scope_check", severity: "hard", message: "out of scope" },
    ]
    const result = buildPipelineResult(
      { type: "execution", principals: ["scope_control", "minimal_change"] },
      { pass: false, errors }
    )
    assert.strictEqual(result.admitted, false)
    assert.strictEqual(result.normalizedDeclaration, undefined)
    assert.ok(result.failureSummary)
    assert.strictEqual(result.failureSummary!.primaryCode, ValidationErrorCode.SCOPE_VIOLATION)
  })

  it("normalizedDeclaration.validators includes all derived validators", () => {
    const result = buildPipelineResult(
      { type: "diagnosis", principals: ["evidence_based", "causality"] },
      { pass: true, errors: [] }
    )
    const v = result.normalizedDeclaration!.validators
    assert.ok(v.includes("evidence_coverage"))
    assert.ok(v.includes("causal_link_check"))
  })

  it("failureSummary.secondaryCodes excludes primaryCode and deduplicates", () => {
    const errors: ValidationError[] = [
      { code: ValidationErrorCode.SCOPE_VIOLATION,         validator: "scope_check",    severity: "hard", message: "a" },
      { code: ValidationErrorCode.DIFF_TOO_LARGE,          validator: "diff_size_check", severity: "hard", message: "b" },
      { code: ValidationErrorCode.WEAK_CAUSAL_LINK,        validator: "causal_link_check", severity: "semi", message: "c" },
    ]
    const result = buildPipelineResult(
      { type: "execution", principals: ["scope_control", "minimal_change"] },
      { pass: false, errors }
    )
    assert.strictEqual(result.failureSummary!.primaryCode, ValidationErrorCode.SCOPE_VIOLATION)
    assert.ok(result.failureSummary!.secondaryCodes.includes(ValidationErrorCode.DIFF_TOO_LARGE))
    assert.ok(result.failureSummary!.secondaryCodes.includes(ValidationErrorCode.WEAK_CAUSAL_LINK))
    assert.ok(!result.failureSummary!.secondaryCodes.includes(ValidationErrorCode.SCOPE_VIOLATION))
  })
})
