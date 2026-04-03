import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import {
  validateEvidenceCoverage,
  validateTypePrincipalBinding,
  validateAttribution,
  validateLayerOrder,
  validateEnvironmentIndependence,
  validatePlanningLoop,
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

// ── validateEnvironmentIndependence (p175 / CF-ENV-001) ───────────────────────

describe("validateEnvironmentIndependence", () => {
  it("P_DEBUG_ENV_INDEPENDENCE not declared → passes regardless", () => {
    const result = validateEnvironmentIndependence(makeDecl({
      principals_used: ["P_DEBUG_ROOT_CAUSE_ISOLATION"],
      evidence:        [],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("CF-ENV-001: diagnosis declaration missing P_DEBUG_ENV_INDEPENDENCE → passes (opt-in)", () => {
    // Opt-in gate: validator only fires when principal is declared.
    // A diagnosis that does NOT declare P_DEBUG_ENV_INDEPENDENCE is not checked here.
    const result = validateEnvironmentIndependence(makeDecl({
      phase:           "ANALYZE",
      type:            "debugging",
      principals_used: ["P_DEBUG_ROOT_CAUSE_ISOLATION"],
      evidence:        [{ type: "runtime", content: "ModuleNotFoundError: jingu-protocol" }],
      claims:          [{ statement: "Module missing", supported_by: [0] }],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("CF-ENV-001: diagnosis with P_DEBUG_ENV_INDEPENDENCE but no env validation evidence → ENV_LEAKAGE_HARDCODE_PATH", () => {
    // This is the CF-ENV-001 failure: declared the principal but evidence only
    // shows the symptom (module not found), not environment validation.
    const result = validateEnvironmentIndependence(makeDecl({
      phase:           "ANALYZE",
      type:            "debugging",
      principals_used: ["P_DEBUG_ENV_INDEPENDENCE", "P_DEBUG_ROOT_CAUSE_ISOLATION", "P_DEBUG_VERIFY_BEFORE_ATTRIBUTION"],
      evidence:        [
        { type: "runtime", content: "ModuleNotFoundError: Cannot find module jingu-protocol" },
        { type: "code",    content: "gate_runner.js imports jingu-protocol" },
      ],
      claims:          [
        { statement: "jingu-protocol module is missing", supported_by: [0, 1] },
      ],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors.length, 1)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.ENV_LEAKAGE_HARDCODE_PATH)
    assert.ok(result.errors[0].message.includes("environment validation"))
  })

  it("CF-ENV-001 fixed: P_DEBUG_ENV_INDEPENDENCE + env validation evidence → passes", () => {
    // Correct declaration: declared the principal AND provided env validation proof.
    const result = validateEnvironmentIndependence(makeDecl({
      phase:           "ANALYZE",
      type:            "debugging",
      principals_used: ["P_DEBUG_ENV_INDEPENDENCE", "P_DEBUG_ROOT_CAUSE_ISOLATION", "P_DEBUG_VERIFY_BEFORE_ATTRIBUTION"],
      evidence:        [
        { type: "runtime", content: "ModuleNotFoundError: Cannot find module jingu-protocol" },
        { type: "code",    content: "gate_runner.js imports jingu-protocol" },
        { type: "runtime", content: "preflight check: node_modules directory missing on EC2 runner — npm install required" },
      ],
      claims:          [
        { statement: "jingu-protocol module missing because node_modules not pre-installed on runner", supported_by: [0, 1, 2] },
      ],
    }))
    assert.strictEqual(result.pass, true)
    assert.strictEqual(result.errors.length, 0)
  })

  it("smoke test evidence keyword → passes", () => {
    const result = validateEnvironmentIndependence(makeDecl({
      principals_used: ["P_DEBUG_ENV_INDEPENDENCE"],
      evidence:        [
        { type: "runtime", content: "smoke test passed: gate_runner.js executed successfully on runner" },
      ],
      claims: [{ statement: "env is valid", supported_by: [0] }],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("local path leakage in evidence → ENV_LEAKAGE_HARDCODE_PATH even with env check keyword", () => {
    const result = validateEnvironmentIndependence(makeDecl({
      principals_used: ["P_DEBUG_ENV_INDEPENDENCE"],
      evidence:        [
        { type: "code",    content: "env check: /root/jingu-swebench/jingu-trust-gate/node_modules" },
      ],
      claims: [{ statement: "path hardcoded", supported_by: [0] }],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.ENV_LEAKAGE_HARDCODE_PATH)
    assert.ok(result.errors[0].message.includes("local path leakage"))
  })

  it("activation proof keyword → passes", () => {
    const result = validateEnvironmentIndependence(makeDecl({
      principals_used: ["P_DEBUG_ENV_INDEPENDENCE"],
      evidence:        [
        { type: "runtime", content: "activation proof: GATE_OK received, jingu-protocol loaded successfully" },
      ],
      claims: [{ statement: "gate active", supported_by: [0] }],
    }))
    assert.strictEqual(result.pass, true)
  })
})

// ── validatePlanningLoop (p176) ───────────────────────────────────────────────

describe("validatePlanningLoop", () => {
  it("P_PLAN_CLOSE_THE_LOOP not declared → passes regardless", () => {
    const result = validatePlanningLoop(makeDecl({
      principals_used: ["P_DEBUG_ROOT_CAUSE_ISOLATION"],
      evidence:        [],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("P_PLAN_CLOSE_THE_LOOP declared with no evidence → PLAN_NO_FEEDBACK_LOOP", () => {
    const result = validatePlanningLoop(makeDecl({
      phase:           "PLAN",
      type:            "planning",
      principals_used: ["P_PLAN_CLOSE_THE_LOOP", "P_PLAN_BOTTLENECK_FIRST"],
      evidence:        [],
      claims:          [{ statement: "We will improve quality", supported_by: [] }],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.PLAN_NO_FEEDBACK_LOOP)
  })

  it("P_PLAN_CLOSE_THE_LOOP declared but evidence has no feedback keywords → PLAN_NO_FEEDBACK_LOOP", () => {
    const result = validatePlanningLoop(makeDecl({
      phase:           "PLAN",
      type:            "planning",
      principals_used: ["P_PLAN_CLOSE_THE_LOOP"],
      evidence:        [
        { type: "doc", content: "strategy: improve the system architecture" },
        { type: "doc", content: "focus on bottleneck reduction" },
      ],
      claims: [{ statement: "architecture improvement", supported_by: [0] }],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.PLAN_NO_FEEDBACK_LOOP)
  })

  it("P_PLAN_CLOSE_THE_LOOP with verification evidence → passes", () => {
    const result = validatePlanningLoop(makeDecl({
      phase:           "PLAN",
      type:            "planning",
      principals_used: ["P_PLAN_CLOSE_THE_LOOP", "P_PLAN_BOTTLENECK_FIRST"],
      evidence:        [
        { type: "doc",     content: "bottleneck: retry controller not implemented" },
        { type: "runtime", content: "verification: run pytest tests/test_retry_controller.py and confirm all pass" },
      ],
      claims: [
        { statement: "RetryController will be verified by test suite", supported_by: [0, 1] },
      ],
    }))
    assert.strictEqual(result.pass, true)
    assert.strictEqual(result.errors.length, 0)
  })

  it("planning type with required principals present → validateTypePrincipalBinding passes", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      type:            "planning",
      principals_used: ["P_PLAN_CLOSE_THE_LOOP", "P_PLAN_BOTTLENECK_FIRST"],
    }))
    assert.strictEqual(result.pass, true)
  })

  it("planning type missing P_PLAN_BOTTLENECK_FIRST → MISSING_REQUIRED_PRINCIPAL", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      type:            "planning",
      principals_used: ["P_PLAN_CLOSE_THE_LOOP"],
    }))
    assert.strictEqual(result.pass, false)
    assert.strictEqual(result.errors[0].code, PrincipalValidatorCode.MISSING_REQUIRED_PRINCIPAL)
    assert.ok(result.errors[0].message.includes("P_PLAN_BOTTLENECK_FIRST"))
  })

  it("planning type missing both required → 2 MISSING_REQUIRED_PRINCIPAL errors", () => {
    const result = validateTypePrincipalBinding(makeDecl({
      type:            "planning",
      principals_used: ["P_PLAN_SEPARATION_OF_CONCERNS"],
    }))
    assert.strictEqual(result.errors.length, 2)
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
