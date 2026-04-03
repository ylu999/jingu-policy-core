import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import {
  ATTRIBUTION_RULES,
  ATTRIBUTION_PRIORITY,
  attributeFailure,
  selectPrimaryAttribution,
  buildFailureTrace,
} from "./failure-attribution.js"
import { ValidationErrorCode } from "./validator-pipeline.js"
import type { ValidationError } from "./validator-pipeline.js"

// ── ATTRIBUTION_RULES structural invariants ───────────────────────────────────

describe("ATTRIBUTION_RULES — structural invariants", () => {
  it("has exactly 9 rules", () => {
    assert.strictEqual(ATTRIBUTION_RULES.length, 9)
  })

  it("all rules have required fields", () => {
    for (const rule of ATTRIBUTION_RULES) {
      assert.ok(rule.errorCode.length > 0,     `rule missing errorCode`)
      assert.ok(rule.attributedPhase.length > 0, `rule missing attributedPhase`)
      assert.ok(rule.confidence,               `rule missing confidence`)
      assert.ok(rule.reasonTemplate.length > 0, `rule missing reasonTemplate`)
    }
  })

  it("MISSING_EVIDENCE_FOR_CLAIM → ANALYZE / evidence_based / high", () => {
    const rule = ATTRIBUTION_RULES.find(r => r.errorCode === ValidationErrorCode.MISSING_EVIDENCE_FOR_CLAIM)
    assert.ok(rule)
    assert.strictEqual(rule!.attributedPhase,     "ANALYZE")
    assert.strictEqual(rule!.attributedPrincipal, "evidence_based")
    assert.strictEqual(rule!.confidence,          "high")
  })

  it("EXECUTION_FAILED → EXECUTE / execution_first / high", () => {
    const rule = ATTRIBUTION_RULES.find(r => r.errorCode === ValidationErrorCode.EXECUTION_FAILED)
    assert.ok(rule)
    assert.strictEqual(rule!.attributedPhase,     "EXECUTE")
    assert.strictEqual(rule!.attributedPrincipal, "execution_first")
    assert.strictEqual(rule!.confidence,          "high")
  })

  it("SCOPE_VIOLATION → EXECUTE / scope_control / high", () => {
    const rule = ATTRIBUTION_RULES.find(r => r.errorCode === ValidationErrorCode.SCOPE_VIOLATION)
    assert.ok(rule)
    assert.strictEqual(rule!.attributedPhase,     "EXECUTE")
    assert.strictEqual(rule!.attributedPrincipal, "scope_control")
    assert.strictEqual(rule!.confidence,          "high")
  })

  it("INCOMPLETE_COVERAGE → PLAN / completeness / medium", () => {
    const rule = ATTRIBUTION_RULES.find(r => r.errorCode === ValidationErrorCode.INCOMPLETE_COVERAGE)
    assert.ok(rule)
    assert.strictEqual(rule!.attributedPhase,     "PLAN")
    assert.strictEqual(rule!.attributedPrincipal, "completeness")
    assert.strictEqual(rule!.confidence,          "medium")
  })
})

// ── attributeFailure ──────────────────────────────────────────────────────────

const decl = { phase: "analyze", type: "diagnosis", principals: ["evidence_based"] }

describe("attributeFailure", () => {
  it("MISSING_EVIDENCE_FOR_CLAIM → ANALYZE / evidence_based / high", () => {
    const errors: ValidationError[] = [{
      code:      ValidationErrorCode.MISSING_EVIDENCE_FOR_CLAIM,
      validator: "evidence_coverage",
      severity:  "hard",
      message:   "no evidence found",
    }]
    const result = attributeFailure(decl, errors)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].phase,      "ANALYZE")
    assert.strictEqual(result[0].principal,  "evidence_based")
    assert.strictEqual(result[0].confidence, "high")
    assert.strictEqual(result[0].type,       "diagnosis")
  })

  it("EXECUTION_FAILED → EXECUTE / execution_first / high", () => {
    const errors: ValidationError[] = [{
      code:      ValidationErrorCode.EXECUTION_FAILED,
      validator: "execution_check",
      severity:  "hard",
      message:   "execution failed",
    }]
    const result = attributeFailure(
      { type: "execution", principals: ["execution_first"] },
      errors
    )
    assert.strictEqual(result[0].phase,      "EXECUTE")
    assert.strictEqual(result[0].principal,  "execution_first")
    assert.strictEqual(result[0].confidence, "high")
  })

  it("unknown error code → confidence low, no principal", () => {
    const errors: ValidationError[] = [{
      code:      "TOTALLY_UNKNOWN_CODE" as never,
      validator: "some_unknown_validator" as never,
      severity:  "hard",
      message:   "mystery error",
    }]
    const result = attributeFailure(decl, errors)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].confidence, "low")
    assert.strictEqual(result[0].principal,  undefined)
    assert.ok(result[0].reason.includes("No attribution rule found"))
  })

  it("multiple errors produce multiple attributions", () => {
    const errors: ValidationError[] = [
      { code: ValidationErrorCode.SCOPE_VIOLATION,         validator: "scope_check",    severity: "hard", message: "a" },
      { code: ValidationErrorCode.MISSING_EVIDENCE_FOR_CLAIM, validator: "evidence_coverage", severity: "hard", message: "b" },
    ]
    const result = attributeFailure({ type: "execution", principals: ["scope_control"] }, errors)
    assert.strictEqual(result.length, 2)
    const phases = result.map(r => r.phase)
    assert.ok(phases.includes("EXECUTE"))
    assert.ok(phases.includes("ANALYZE"))
  })

  it("WEAK_CAUSAL_LINK → ANALYZE / causality / medium", () => {
    const errors: ValidationError[] = [{
      code:      ValidationErrorCode.WEAK_CAUSAL_LINK,
      validator: "causal_link_check",
      severity:  "semi",
      message:   "causal chain incomplete",
    }]
    const result = attributeFailure({ type: "diagnosis", principals: ["causality"] }, errors)
    assert.strictEqual(result[0].phase,      "ANALYZE")
    assert.strictEqual(result[0].principal,  "causality")
    assert.strictEqual(result[0].confidence, "medium")
  })
})

// ── selectPrimaryAttribution ──────────────────────────────────────────────────

describe("selectPrimaryAttribution", () => {
  it("returns undefined for empty attributions", () => {
    const result = selectPrimaryAttribution([], [])
    assert.strictEqual(result, undefined)
  })

  it("EXECUTION_FAILED beats MISSING_EVIDENCE_FOR_CLAIM (higher priority)", () => {
    const errors: ValidationError[] = [
      { code: ValidationErrorCode.MISSING_EVIDENCE_FOR_CLAIM, validator: "evidence_coverage", severity: "hard", message: "a" },
      { code: ValidationErrorCode.EXECUTION_FAILED,           validator: "execution_check",   severity: "hard", message: "b" },
    ]
    const attributions = attributeFailure({ type: "execution", principals: [] }, errors)
    const primary = selectPrimaryAttribution(attributions, errors)
    assert.ok(primary)
    assert.strictEqual(primary!.errorCode, ValidationErrorCode.EXECUTION_FAILED)
  })

  it("single attribution is returned as primary", () => {
    const errors: ValidationError[] = [{
      code: ValidationErrorCode.SCOPE_VIOLATION, validator: "scope_check", severity: "hard", message: "out of scope"
    }]
    const attributions = attributeFailure({ type: "execution", principals: [] }, errors)
    const primary = selectPrimaryAttribution(attributions, errors)
    assert.ok(primary)
    assert.strictEqual(primary!.errorCode, ValidationErrorCode.SCOPE_VIOLATION)
  })

  it("high confidence wins when validator priority is tied", () => {
    // Use two unknown errors so neither matches ATTRIBUTION_PRIORITY
    const errors: ValidationError[] = [
      { code: "UNKNOWN_A" as never, validator: "x" as never, severity: "hard", message: "a" },
      { code: "UNKNOWN_B" as never, validator: "y" as never, severity: "hard", message: "b" },
    ]
    const attributions = [
      { errorCode: "UNKNOWN_A", confidence: "low"  as const, reason: "a" },
      { errorCode: "UNKNOWN_B", confidence: "high" as const, reason: "b" },
    ]
    const primary = selectPrimaryAttribution(attributions, errors)
    assert.ok(primary)
    assert.strictEqual(primary!.confidence, "high")
  })
})

// ── buildFailureTrace ─────────────────────────────────────────────────────────

describe("buildFailureTrace", () => {
  it("produces valid FailureTrace shape", () => {
    const errors: ValidationError[] = [{
      code:      ValidationErrorCode.SCOPE_VIOLATION,
      validator: "scope_check",
      severity:  "hard",
      message:   "out of scope",
    }]
    const trace = buildFailureTrace(
      "task-001",
      "run-abc",
      { phase: "execute", type: "execution", subType: "code_change", principals: ["scope_control"] },
      ["scope_check", "execution_check"],
      errors
    )

    assert.strictEqual(trace.taskId,      "task-001")
    assert.strictEqual(trace.runId,       "run-abc")
    assert.strictEqual(trace.declaration.type,    "execution")
    assert.strictEqual(trace.declaration.subType, "code_change")
    assert.deepStrictEqual(trace.validatorsRun, ["scope_check", "execution_check"])
    assert.strictEqual(trace.errors.length,      1)
    assert.strictEqual(trace.attributions.length, 1)
    assert.ok(trace.primaryAttribution)
    assert.strictEqual(trace.primaryAttribution!.errorCode, ValidationErrorCode.SCOPE_VIOLATION)
    assert.ok(trace.timestamp.length > 0)
  })

  it("primaryAttribution is undefined when errors is empty", () => {
    const trace = buildFailureTrace("t", "r", { type: "execution", principals: [] }, [], [])
    assert.strictEqual(trace.primaryAttribution, undefined)
    assert.deepStrictEqual(trace.attributions, [])
  })

  it("timestamp is valid ISO string", () => {
    const trace = buildFailureTrace("t", "r", { type: "analysis", principals: [] }, [], [])
    assert.doesNotThrow(() => new Date(trace.timestamp))
    assert.ok(new Date(trace.timestamp).getTime() > 0)
  })
})

// ── ATTRIBUTION_PRIORITY ──────────────────────────────────────────────────────

describe("ATTRIBUTION_PRIORITY", () => {
  it("execution_check is first (highest priority)", () => {
    assert.strictEqual(ATTRIBUTION_PRIORITY[0], "execution_check")
  })

  it("evidence_coverage is second", () => {
    assert.strictEqual(ATTRIBUTION_PRIORITY[1], "evidence_coverage")
  })

  it("contains at least 8 validators", () => {
    assert.ok(ATTRIBUTION_PRIORITY.length >= 8)
  })
})
