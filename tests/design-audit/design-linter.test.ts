// tests/linter/design-linter.test.ts
// Unit: Jingu Design Linter — 4 invariant rules

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  lintLoopDesign,
  isDesignValid,
  checkStateMachineCompleteness,
  checkLayerSeparation,
  checkRecoverability,
  checkContractEnforcement,
} from "../../src/design-audit/index.js"
import type { LoopDesignSpec } from "../../src/design-audit/index.js"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The canonical well-formed Unit 2.2 design. All 4 rules should pass. */
function makeValidSpec(): LoopDesignSpec {
  return {
    attempts: 2,
    stages: ["proposer", "binding_validator", "reviewer", "gates"],
    verdicts: ["pass", "fail", "reject", "invalid_output"],
    retryPolicy: {
      maxAttempts: 2,
      retryOn: ["INVALID_RULE_ID"],
    },
    errorTypes: [
      { code: "NON_JSON_OUTPUT",        layer: "syntax",    recoverable: false },
      { code: "MISSING_REQUIRED_STAGE", layer: "structure", recoverable: false },
      { code: "INVALID_RULE_ID",        layer: "structure", recoverable: true  },
      { code: "UNJUSTIFIED_DECISION",   layer: "structure", recoverable: true  },
      { code: "REVIEWER_REJECT",        layer: "semantics", recoverable: false },
      { code: "GATE_FAIL",              layer: "execution", recoverable: true  },
    ],
  }
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("lintLoopDesign — valid spec produces no errors", () => {
  it("valid spec returns empty issues array", () => {
    const issues = lintLoopDesign(makeValidSpec())
    assert.deepEqual(issues, [])
  })

  it("isDesignValid returns true for valid spec", () => {
    assert.equal(isDesignValid(makeValidSpec()), true)
  })

  it("null input throws", () => {
    assert.throws(
      () => lintLoopDesign(null as unknown as LoopDesignSpec),
      /lintLoopDesign: spec is required/
    )
  })
})

// ---------------------------------------------------------------------------
// Rule 1 — State Machine Completeness
// ---------------------------------------------------------------------------

describe("Rule 1 — checkStateMachineCompleteness", () => {
  it("maxAttempts=0 → INVALID_RETRY_POLICY error", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.maxAttempts = 0
    const issues = checkStateMachineCompleteness(spec)
    assert.ok(issues.some(i => i.code === "INVALID_RETRY_POLICY" && i.severity === "error"))
  })

  it("maxAttempts=-1 → INVALID_RETRY_POLICY error", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.maxAttempts = -1
    const issues = checkStateMachineCompleteness(spec)
    assert.ok(issues.some(i => i.code === "INVALID_RETRY_POLICY"))
  })

  it("maxAttempts=4 → UNBOUNDED_RETRY_RISK warning", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.maxAttempts = 4
    const issues = checkStateMachineCompleteness(spec)
    assert.ok(issues.some(i => i.code === "UNBOUNDED_RETRY_RISK" && i.severity === "warning"))
  })

  it("maxAttempts=3 → no warning (boundary)", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.maxAttempts = 3
    const issues = checkStateMachineCompleteness(spec)
    assert.ok(!issues.some(i => i.code === "UNBOUNDED_RETRY_RISK"))
  })

  it("missing invalid_output verdict → MISSING_INVALID_OUTPUT_VERDICT error", () => {
    const spec = makeValidSpec()
    spec.verdicts = ["pass", "fail", "reject"]  // no invalid_output
    const issues = checkStateMachineCompleteness(spec)
    assert.ok(issues.some(i => i.code === "MISSING_INVALID_OUTPUT_VERDICT" && i.severity === "error"))
  })

  it("reviewer before binding_validator → REVIEWER_BEFORE_BINDING error", () => {
    const spec = makeValidSpec()
    spec.stages = ["proposer", "reviewer", "binding_validator", "gates"]  // reviewer first
    const issues = checkStateMachineCompleteness(spec)
    assert.ok(issues.some(i => i.code === "REVIEWER_BEFORE_BINDING" && i.severity === "error"))
  })

  it("binding_validator before reviewer → no error", () => {
    const spec = makeValidSpec()  // already correct order
    const issues = checkStateMachineCompleteness(spec)
    assert.ok(!issues.some(i => i.code === "REVIEWER_BEFORE_BINDING"))
  })

  it("valid spec → no Rule 1 errors", () => {
    const issues = checkStateMachineCompleteness(makeValidSpec())
    assert.deepEqual(issues, [])
  })
})

// ---------------------------------------------------------------------------
// Rule 2 — Layer Separation
// ---------------------------------------------------------------------------

describe("Rule 2 — checkLayerSeparation", () => {
  it("reviewer present without binding_validator → SEMANTICS_WITHOUT_STRUCTURE_GATE error", () => {
    const spec = makeValidSpec()
    spec.stages = ["proposer", "reviewer", "gates"]  // no binding_validator
    const issues = checkLayerSeparation(spec)
    assert.ok(issues.some(i => i.code === "SEMANTICS_WITHOUT_STRUCTURE_GATE" && i.severity === "error"))
  })

  it("both syntax and structure errors in retryOn → MIXED_LAYER_RETRY warning", () => {
    const spec = makeValidSpec()
    spec.errorTypes = [
      { code: "SYNTAX_ERR",    layer: "syntax",    recoverable: true },
      { code: "STRUCTURE_ERR", layer: "structure", recoverable: true },
    ]
    spec.retryPolicy.retryOn = ["SYNTAX_ERR", "STRUCTURE_ERR"]
    const issues = checkLayerSeparation(spec)
    assert.ok(issues.some(i => i.code === "MIXED_LAYER_RETRY" && i.severity === "warning"))
  })

  it("only structure errors in retryOn → no MIXED_LAYER_RETRY", () => {
    const spec = makeValidSpec()
    spec.errorTypes = [
      { code: "SYNTAX_ERR",    layer: "syntax",    recoverable: false },
      { code: "STRUCTURE_ERR", layer: "structure", recoverable: true },
    ]
    spec.retryPolicy.retryOn = ["STRUCTURE_ERR"]
    const issues = checkLayerSeparation(spec)
    assert.ok(!issues.some(i => i.code === "MIXED_LAYER_RETRY"))
  })

  it("valid spec → no Rule 2 errors", () => {
    const issues = checkLayerSeparation(makeValidSpec())
    assert.deepEqual(issues, [])
  })
})

// ---------------------------------------------------------------------------
// Rule 3 — Recoverability
// ---------------------------------------------------------------------------

describe("Rule 3 — checkRecoverability", () => {
  it("retryOn includes non-recoverable error → NON_RECOVERABLE_RETRY error", () => {
    const spec = makeValidSpec()
    // MISSING_REQUIRED_STAGE is non-recoverable but put in retryOn
    spec.retryPolicy.retryOn = ["MISSING_REQUIRED_STAGE"]
    const issues = checkRecoverability(spec)
    assert.ok(issues.some(i => i.code === "NON_RECOVERABLE_RETRY" && i.severity === "error"))
  })

  it("retryOn includes unknown code → UNDEFINED_RETRY_CODE error", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.retryOn = ["TOTALLY_MADE_UP_CODE"]
    const issues = checkRecoverability(spec)
    assert.ok(issues.some(i => i.code === "UNDEFINED_RETRY_CODE" && i.severity === "error"))
  })

  it("maxAttempts=2 with empty retryOn → RETRY_WITH_NO_TRIGGER warning", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.retryOn = []
    const issues = checkRecoverability(spec)
    assert.ok(issues.some(i => i.code === "RETRY_WITH_NO_TRIGGER" && i.severity === "warning"))
  })

  it("maxAttempts=1 with empty retryOn → no warning (single attempt is fine)", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.maxAttempts = 1
    spec.retryPolicy.retryOn = []
    const issues = checkRecoverability(spec)
    assert.ok(!issues.some(i => i.code === "RETRY_WITH_NO_TRIGGER"))
  })

  it("retryOn with recoverable error → no error", () => {
    const spec = makeValidSpec()  // INVALID_RULE_ID is recoverable=true
    const issues = checkRecoverability(spec)
    assert.deepEqual(issues, [])
  })

  it("valid spec → no Rule 3 errors", () => {
    const issues = checkRecoverability(makeValidSpec())
    assert.deepEqual(issues, [])
  })
})

// ---------------------------------------------------------------------------
// Rule 4 — Contract Enforcement
// ---------------------------------------------------------------------------

describe("Rule 4 — checkContractEnforcement", () => {
  it("syntax errors present + invalid_output missing → CONTRACT_VIOLATIONS_WITHOUT_VERDICT error", () => {
    const spec = makeValidSpec()
    spec.verdicts = ["pass", "fail", "reject"]  // no invalid_output
    const issues = checkContractEnforcement(spec)
    assert.ok(issues.some(i => i.code === "CONTRACT_VIOLATIONS_WITHOUT_VERDICT" && i.severity === "error"))
  })

  it("structure errors present + invalid_output missing → CONTRACT_VIOLATIONS_WITHOUT_VERDICT error", () => {
    const spec = makeValidSpec()
    spec.errorTypes = [{ code: "MISSING_REQUIRED_STAGE", layer: "structure", recoverable: false }]
    spec.verdicts = ["pass", "fail", "reject"]
    spec.retryPolicy.retryOn = []
    const issues = checkContractEnforcement(spec)
    assert.ok(issues.some(i => i.code === "CONTRACT_VIOLATIONS_WITHOUT_VERDICT"))
  })

  it("syntax error in retryOn → SYNTAX_ERROR_RETRIED warning", () => {
    const spec = makeValidSpec()
    spec.errorTypes.push({ code: "NON_JSON", layer: "syntax", recoverable: true })
    spec.retryPolicy.retryOn = ["INVALID_RULE_ID", "NON_JSON"]
    const issues = checkContractEnforcement(spec)
    assert.ok(issues.some(i => i.code === "SYNTAX_ERROR_RETRIED" && i.severity === "warning"))
  })

  it("no contract layer errors → no Rule 4 issues", () => {
    const spec = makeValidSpec()
    spec.errorTypes = [
      { code: "REVIEWER_REJECT", layer: "semantics", recoverable: false },
      { code: "GATE_FAIL",       layer: "execution", recoverable: true  },
    ]
    spec.retryPolicy.retryOn = ["GATE_FAIL"]
    const issues = checkContractEnforcement(spec)
    assert.deepEqual(issues, [])
  })

  it("valid spec → no Rule 4 errors", () => {
    const issues = checkContractEnforcement(makeValidSpec())
    assert.deepEqual(issues, [])
  })
})

// ---------------------------------------------------------------------------
// Integration: the "original broken design" from the design review
// ---------------------------------------------------------------------------

describe("lintLoopDesign — catches the Unit 2.2 pre-review design problems", () => {
  it("design with binding_fail verdict + no invalid_output → MISSING_INVALID_OUTPUT_VERDICT", () => {
    const spec = makeValidSpec()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spec.verdicts = ["pass", "fail", "reject", "binding_fail"] as any  // binding_fail ≠ invalid_output
    const issues = lintLoopDesign(spec)
    assert.ok(issues.some(i => i.code === "MISSING_INVALID_OUTPUT_VERDICT"))
  })

  it("design with non-recoverable errors retried → NON_RECOVERABLE_RETRY", () => {
    const spec = makeValidSpec()
    spec.errorTypes = [
      { code: "MISSING_REQUIRED_STAGE", layer: "structure", recoverable: false },
      { code: "INVALID_RULE_ID",        layer: "structure", recoverable: true  },
    ]
    spec.retryPolicy.retryOn = ["MISSING_REQUIRED_STAGE"]
    const issues = lintLoopDesign(spec)
    assert.ok(issues.some(i => i.code === "NON_RECOVERABLE_RETRY"))
  })

  it("reviewer before binding → REVIEWER_BEFORE_BINDING", () => {
    const spec = makeValidSpec()
    spec.stages = ["proposer", "reviewer", "binding_validator", "gates"]
    const issues = lintLoopDesign(spec)
    assert.ok(issues.some(i => i.code === "REVIEWER_BEFORE_BINDING"))
  })

  it("corrected Unit 2.2 design passes all rules", () => {
    const issues = lintLoopDesign(makeValidSpec())
    assert.deepEqual(issues, [])
  })
})
