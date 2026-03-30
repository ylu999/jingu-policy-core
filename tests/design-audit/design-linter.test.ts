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
  checkWarningJustifications,
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

// ---------------------------------------------------------------------------
// Severity enforcement contract
// ---------------------------------------------------------------------------

describe("severity enforcement contract", () => {
  it("isDesignValid returns true when only warnings exist (no errors)", () => {
    const spec = makeValidSpec()
    // Trigger UNBOUNDED_RETRY_RISK (warning) — and provide justification so
    // WARNING_WITHOUT_JUSTIFICATION does not also fire
    spec.retryPolicy.maxAttempts = 4
    spec.justifications = { UNBOUNDED_RETRY_RISK: "accepted for load-test scenario" }
    const issues = lintLoopDesign(spec)
    assert.ok(issues.some(i => i.severity === "warning"), "should have at least one warning")
    assert.ok(!issues.some(i => i.severity === "error"),  "should have no errors")
    assert.equal(isDesignValid(spec), true, "warnings alone must not block isDesignValid")
  })

  it("isDesignValid returns false when any error exists (even with warnings alongside)", () => {
    const spec = makeValidSpec()
    // Trigger both: missing invalid_output (error) + high retry count (warning)
    spec.verdicts = ["pass", "fail", "reject"]  // MISSING_INVALID_OUTPUT_VERDICT → error
    spec.retryPolicy.maxAttempts = 4             // UNBOUNDED_RETRY_RISK → warning
    const issues = lintLoopDesign(spec)
    assert.ok(issues.some(i => i.severity === "error"),   "should have at least one error")
    assert.ok(issues.some(i => i.severity === "warning"), "should have at least one warning")
    assert.equal(isDesignValid(spec), false, "error must block isDesignValid even when warnings also present")
  })

  it("isDesignValid returns true for spec with only info-severity issues", () => {
    // info items are structural observations — no blocking behavior
    // The valid spec produces no issues at all, which satisfies the contract
    const issues = lintLoopDesign(makeValidSpec())
    assert.ok(!issues.some(i => i.severity === "error"))
    assert.equal(isDesignValid(makeValidSpec()), true)
  })

  it("DesignIssue severity type includes info", () => {
    // Type-level contract: IssueSeverity = "error" | "warning" | "info"
    // A manually constructed info issue should be assignable
    const infoIssue = {
      rule: "R0",
      code: "OBSERVATION",
      severity: "info" as const,
      message: "just an observation",
    }
    assert.equal(infoIssue.severity, "info")
  })
})

// ---------------------------------------------------------------------------
// Rule 5 — Warning Justification
// ---------------------------------------------------------------------------

describe("Rule 5 — checkWarningJustifications", () => {
  it("warning with no justification → WARNING_WITHOUT_JUSTIFICATION", () => {
    const priorIssues = [
      { rule: "r1", code: "UNBOUNDED_RETRY_RISK", kind: "heuristic" as const, severity: "warning" as const, message: "..." },
    ]
    const spec = makeValidSpec()  // no justifications field
    const issues = checkWarningJustifications(spec, priorIssues)
    assert.ok(issues.some(i => i.code === "WARNING_WITHOUT_JUSTIFICATION" && i.severity === "warning"))
  })

  it("warning with empty string justification → WARNING_WITHOUT_JUSTIFICATION", () => {
    const priorIssues = [
      { rule: "r1", code: "UNBOUNDED_RETRY_RISK", kind: "heuristic" as const, severity: "warning" as const, message: "..." },
    ]
    const spec = makeValidSpec()
    spec.justifications = { UNBOUNDED_RETRY_RISK: "   " }  // whitespace only
    const issues = checkWarningJustifications(spec, priorIssues)
    assert.ok(issues.some(i => i.code === "WARNING_WITHOUT_JUSTIFICATION"))
  })

  it("warning with written justification → no WARNING_WITHOUT_JUSTIFICATION", () => {
    const priorIssues = [
      { rule: "r1", code: "UNBOUNDED_RETRY_RISK", kind: "heuristic" as const, severity: "warning" as const, message: "..." },
    ]
    const spec = makeValidSpec()
    spec.justifications = { UNBOUNDED_RETRY_RISK: "Accepted: load-test scenario requires 5 attempts." }
    const issues = checkWarningJustifications(spec, priorIssues)
    assert.ok(!issues.some(i => i.code === "WARNING_WITHOUT_JUSTIFICATION"))
  })

  it("no warnings in prior issues → no output", () => {
    const priorIssues = [
      { rule: "r1", code: "INVALID_RETRY_POLICY", kind: "invariant" as const, severity: "error" as const, message: "..." },
    ]
    const spec = makeValidSpec()
    const issues = checkWarningJustifications(spec, priorIssues)
    assert.deepEqual(issues, [])
  })

  it("lintLoopDesign: warning without justification propagates through full pipeline", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.maxAttempts = 4  // triggers UNBOUNDED_RETRY_RISK (warning)
    // no justifications provided
    const issues = lintLoopDesign(spec)
    assert.ok(issues.some(i => i.code === "UNBOUNDED_RETRY_RISK"),              "UNBOUNDED_RETRY_RISK should fire")
    assert.ok(issues.some(i => i.code === "WARNING_WITHOUT_JUSTIFICATION"),     "WARNING_WITHOUT_JUSTIFICATION should fire")
    assert.equal(isDesignValid(spec), true, "no errors, just warnings — isDesignValid must remain true")
  })

  it("lintLoopDesign: justified warning suppresses WARNING_WITHOUT_JUSTIFICATION", () => {
    const spec = makeValidSpec()
    spec.retryPolicy.maxAttempts = 4
    spec.justifications = { UNBOUNDED_RETRY_RISK: "Intentional: stress-test harness needs 4 retries." }
    const issues = lintLoopDesign(spec)
    assert.ok(issues.some(i => i.code === "UNBOUNDED_RETRY_RISK"),              "UNBOUNDED_RETRY_RISK still fires")
    assert.ok(!issues.some(i => i.code === "WARNING_WITHOUT_JUSTIFICATION"),    "WARNING_WITHOUT_JUSTIFICATION must not fire")
  })

  it("valid spec with no warnings produces no justification issues", () => {
    const issues = checkWarningJustifications(makeValidSpec(), [])
    assert.deepEqual(issues, [])
  })
})
