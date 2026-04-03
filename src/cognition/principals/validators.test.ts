import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import {
  validateEvidenceCoverage,
  validateTypePrincipalBinding,
  validateAttribution,
  validateLayerOrder,
  runPrincipalValidators,
  PrincipalValidatorCode,
} from "./validators.js"
import type { CognitionDeclaration } from "./schema.js"

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDecl(overrides: Partial<CognitionDeclaration> = {}): CognitionDeclaration {
  return {
    phase:           "ANALYZE",
    type:            "debugging",
    principals_used: ["P_DEBUG_ROOT_CAUSE_ISOLATION", "P_DEBUG_VERIFY_BEFORE_ATTRIBUTION"],
    evidence:        [
      { type: "code", content: "infra check: network timeout observed" },
      { type: "runtime", content: "model layer: LLM returned empty response" },
    ],
    claims:          [
      { statement: "Network timeout caused the failure", supported_by: [0] },
    ],
    ...overrides,
  }
}

// ── validateEvidenceCoverage ──────────────────────────────────────────────────

describe("validateEvidenceCoverage", () => {
  it("passes when all claims have evidence refs", () => {
    const result = validateEvidenceCoverage(makeDecl())
    assert.strictEqual(result.pass, true)
    assert.strictEqual(result.errors.length, 0)
  })

  it("claim with empty supported_by → UNSUPPORTED_CLAIM", () => {
    const result = validateEvidenceCoverage(makeDecl({
      claims: [
        { statement: "This is unsupported", supported_by: [] },
      ],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors.length, 1)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.UNSUPPORTED_CLAIM)
    assert.strictEqual(result.errors[0].claimIndex, 0)
  })

  it("multiple unsupported claims → multiple errors", () => {
    const result = validateEvidenceCoverage(makeDecl({
      claims: [
        { statement: "Claim A", supported_by: [] },
        { statement: "Claim B", supported_by: [0] },
        { statement: "Claim C", supported_by: [] },
      ],
    }))
    assert.strictEqual(result.errors.length, 2)
    assert.strictEqual(result.errors[0].claimIndex, 0)
    assert.strictEqual(result.errors[1].claimIndex, 2)
  })

  it("no claims → passes", () => {
    const result = validateEvidenceCoverage(makeDecl({ claims: [] }))
    assert.strictEqual(result.pass, true)
  })
})

// ── validateTypePrincipalBinding ──────────────────────────────────────────────

describe("validateTypePrincipalBinding", () => {
  it("debugging with both required principals → passes", () => {
    const result = validateTypePrincipalBinding(makeDecl())
    assert.strictEqual(result.pass, true)
  })

  it("debugging missing P_DEBUG_VERIFY_BEFORE_ATTRIBUTION → MISSING_REQUIRED_PRINCIPAL", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      principals_used: ["P_DEBUG_ROOT_CAUSE_ISOLATION"],  // missing P_DEBUG_VERIFY_BEFORE_ATTRIBUTION
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors.length, 1)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.MISSING_REQUIRED_PRINCIPAL)
    assert.ok(result.errors[0].message.includes("P_DEBUG_VERIFY_BEFORE_ATTRIBUTION"))
  })

  it("debugging missing both required → 2 errors", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      principals_used: ["P_DEBUG_LAYER_ORDER"],
    }))
    assert.strictEqual(result.errors.length, 2)
  })

  it("reasoning with P_REASON_EVIDENCE_GROUNDED → passes", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      type:            "reasoning",
      principals_used: ["P_REASON_EVIDENCE_GROUNDED"],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("design with both required → passes", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      type:            "design",
      principals_used: ["P_DESIGN_VERIFY_BEFORE_COMMIT", "P_DESIGN_CONSTRAINT_AWARE"],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("unknown type → passes (no policy for it)", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      type:            "unknown_type",
      principals_used: [],
    }))
    assert.strictEqual(result.pass, true)
  })
})

// ── validateAttribution ───────────────────────────────────────────────────────

describe("validateAttribution", () => {
  it("no attribution → passes", () => {
    const result = validateAttribution(makeDecl({ attribution: undefined }))
    assert.strictEqual(result.pass, true)
  })

  it("attribution with evidence → passes", () => {
    const result = validateAttribution(makeDecl({
      attribution: { target: "network layer", confidence: 0.9 },
      evidence:    [{ type: "runtime", content: "timeout log" }],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("attribution with no evidence → UNSUPPORTED_ATTRIBUTION", () => {
    const result = validateAttribution(makeDecl({
      attribution: { target: "model layer", confidence: 0.7 },
      evidence:    [],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.UNSUPPORTED_ATTRIBUTION)
  })
})

// ── validateLayerOrder ────────────────────────────────────────────────────────

describe("validateLayerOrder", () => {
  it("P_DEBUG_LAYER_ORDER not declared → passes regardless of evidence", () => {
    const result = validateLayerOrder(makeDecl({
      principals_used: ["P_DEBUG_ROOT_CAUSE_ISOLATION"],
      evidence:        [{ type: "code", content: "just one thing" }],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("P_DEBUG_LAYER_ORDER declared with 2 layers → passes", () => {
    const result = validateLayerOrder(makeDecl({
      principals_used: ["P_DEBUG_LAYER_ORDER"],
      evidence:        [
        { type: "code",    content: "infra: network config checked" },
        { type: "runtime", content: "model: LLM timeout returned" },
      ],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("P_DEBUG_LAYER_ORDER declared but only 1 layer → INSUFFICIENT_LAYER_CHECK", () => {
    const result = validateLayerOrder(makeDecl({
      principals_used: ["P_DEBUG_LAYER_ORDER"],
      evidence:        [
        { type: "code", content: "model returned empty" },
        { type: "code", content: "model output was null" },
      ],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.INSUFFICIENT_LAYER_CHECK)
  })

  it("P_DEBUG_LAYER_ORDER with empty evidence → INSUFFICIENT_LAYER_CHECK", () => {
    const result = validateLayerOrder(makeDecl({
      principals_used: ["P_DEBUG_LAYER_ORDER"],
      evidence:        [],
    }))
    assert.strictEqual(result.pass, false)
  })
})

// ── runPrincipalValidators ────────────────────────────────────────────────────

describe("runPrincipalValidators", () => {
  it("fully valid debugging declaration → all pass", () => {
    const result = runPrincipalValidators(makeDecl())
    assert.strictEqual(result.pass, true)
    assert.strictEqual(result.errors.length, 0)
  })

  it("multiple issues combined into single result", () => {
    const result = runPrincipalValidators(makeDecl({
      principals_used: ["P_DEBUG_LAYER_ORDER"],  // missing required, triggers layer check
      claims:          [{ statement: "unsupported", supported_by: [] }],
      evidence:        [{ type: "code", content: "only model mentioned" }],  // 1 layer
    }))
    assert.strictEqual(result.pass, false)
    // Expect: MISSING_REQUIRED_PRINCIPAL x2, UNSUPPORTED_CLAIM, INSUFFICIENT_LAYER_CHECK
    assert.ok(result.errors.length >= 3)
  })
})
