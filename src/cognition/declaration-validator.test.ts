import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import {
  validateDeclaration,
  DeclError,
  TYPE_TO_VALIDATORS,
} from "./declaration-validator.js"

describe("validateDeclaration — valid declarations", () => {
  it("valid execution declaration passes", () => {
    const result = validateDeclaration({
      type: "execution",
      subType: "code_change",
      principals: ["scope_control", "minimal_change"],
    })
    assert.strictEqual(result.valid, true)
    assert.deepStrictEqual(result.errors, [])
  })

  it("valid observation declaration without optional subType passes", () => {
    const result = validateDeclaration({
      type: "observation",
      principals: ["evidence_based", "no_hallucination"],
    })
    assert.strictEqual(result.valid, true)
  })

  it("valid diagnosis declaration with extra optional principal passes", () => {
    const result = validateDeclaration({
      type: "diagnosis",
      subType: "bug_localization",
      principals: ["evidence_based", "causality", "hypothesis_testing"],
    })
    assert.strictEqual(result.valid, true)
  })

  it("valid analysis declaration passes", () => {
    const result = validateDeclaration({
      type: "analysis",
      principals: ["causality"],
    })
    assert.strictEqual(result.valid, true)
  })
})

describe("validateDeclaration — INVALID_TYPE", () => {
  it("unknown type → INVALID_TYPE", () => {
    const result = validateDeclaration({
      type: "root_cause_fix",
      principals: ["evidence_based"],
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.INVALID_TYPE))
  })

  it("INVALID_TYPE short-circuits other checks", () => {
    const result = validateDeclaration({
      type: "nonexistent",
      principals: ["not_a_principal"],
    })
    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.errors.length, 1)
    assert.strictEqual(result.errors[0], DeclError.INVALID_TYPE)
  })
})

describe("validateDeclaration — INVALID_SUBTYPE / TYPE_SUBTYPE_MISMATCH", () => {
  it("subType from wrong type → TYPE_SUBTYPE_MISMATCH", () => {
    const result = validateDeclaration({
      type: "execution",
      subType: "log_reading",  // log_reading belongs to observation
      principals: ["scope_control", "minimal_change"],
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.TYPE_SUBTYPE_MISMATCH))
  })

  it("completely unknown subType → TYPE_SUBTYPE_MISMATCH", () => {
    const result = validateDeclaration({
      type: "execution",
      subType: "invented_subtype",
      principals: ["scope_control", "minimal_change"],
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.TYPE_SUBTYPE_MISMATCH))
  })

  it("valid subType for correct type → passes", () => {
    const result = validateDeclaration({
      type: "observation",
      subType: "log_reading",
      principals: ["evidence_based", "no_hallucination"],
    })
    assert.strictEqual(result.valid, true)
  })
})

describe("validateDeclaration — UNKNOWN_PRINCIPAL", () => {
  it("principal not in 12 atoms → UNKNOWN_PRINCIPAL", () => {
    const result = validateDeclaration({
      type: "execution",
      principals: ["scope_control", "minimal_change", "fix_cause_not_symptom"],
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.UNKNOWN_PRINCIPAL))
    assert.ok(result.errorDetails.some(d => d.includes("fix_cause_not_symptom")))
  })
})

describe("validateDeclaration — MISSING_REQUIRED_PRINCIPAL", () => {
  it("execution missing scope_control → MISSING_REQUIRED_PRINCIPAL", () => {
    const result = validateDeclaration({
      type: "execution",
      principals: ["minimal_change"],  // missing scope_control
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.MISSING_REQUIRED_PRINCIPAL))
    assert.ok(result.errorDetails.some(d => d.includes("scope_control")))
  })

  it("execution missing both required principals → two MISSING_REQUIRED_PRINCIPAL errors", () => {
    const result = validateDeclaration({
      type: "execution",
      principals: ["consistency_check"],  // missing scope_control and minimal_change
    })
    assert.strictEqual(result.valid, false)
    const missingErrors = result.errors.filter(e => e === DeclError.MISSING_REQUIRED_PRINCIPAL)
    assert.strictEqual(missingErrors.length, 2)
  })

  it("diagnosis missing causality → MISSING_REQUIRED_PRINCIPAL", () => {
    const result = validateDeclaration({
      type: "diagnosis",
      principals: ["evidence_based"],  // missing causality
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.MISSING_REQUIRED_PRINCIPAL))
    assert.ok(result.errorDetails.some(d => d.includes("causality")))
  })
})

describe("validateDeclaration — FORBIDDEN_PRINCIPAL_USED", () => {
  it("execution using hypothesis_testing → FORBIDDEN_PRINCIPAL_USED", () => {
    const result = validateDeclaration({
      type: "execution",
      principals: ["scope_control", "minimal_change", "hypothesis_testing"],
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.FORBIDDEN_PRINCIPAL_USED))
    assert.ok(result.errorDetails.some(d => d.includes("hypothesis_testing")))
  })

  it("validation using causality → FORBIDDEN_PRINCIPAL_USED", () => {
    const result = validateDeclaration({
      type: "validation",
      principals: ["execution_first", "consistency_check", "causality"],
    })
    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.includes(DeclError.FORBIDDEN_PRINCIPAL_USED))
  })
})

describe("TYPE_TO_VALIDATORS — strong binding table", () => {
  it("has exactly 9 entries", () => {
    assert.strictEqual(Object.keys(TYPE_TO_VALIDATORS).length, 9)
  })

  it("diagnosis has evidence_coverage, no_unsupported_claim, causal_link_check", () => {
    const v = TYPE_TO_VALIDATORS["diagnosis"]
    assert.ok(v.includes("evidence_coverage"))
    assert.ok(v.includes("no_unsupported_claim"))
    assert.ok(v.includes("causal_link_check"))
  })

  it("execution has scope_check, execution_check, diff_size_check", () => {
    const v = TYPE_TO_VALIDATORS["execution"]
    assert.ok(v.includes("scope_check"))
    assert.ok(v.includes("execution_check"))
    assert.ok(v.includes("diff_size_check"))
  })

  it("planning has coverage_check and consistency_check", () => {
    const v = TYPE_TO_VALIDATORS["planning"]
    assert.ok(v.includes("coverage_check"))
    assert.ok(v.includes("consistency_check"))
  })

  it("all 9 types are covered", () => {
    const expected = [
      "understanding", "observation", "analysis", "diagnosis",
      "decision", "design", "planning", "execution", "validation",
    ]
    for (const t of expected) {
      assert.ok(
        t in TYPE_TO_VALIDATORS,
        `TYPE_TO_VALIDATORS missing entry for "${t}"`
      )
    }
  })
})
