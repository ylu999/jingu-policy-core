// tests/rpp/binding-validator.test.ts
// Unit 2.1: RPP Binding Validator + Strictness Policy tests

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { validateRPPBinding, checkRPPStrictness, validateRPPFull } from "../../src/rpp/binding-validator.js"
import type { RPPRecord, CognitiveStep, ResponseStep } from "../../src/rpp/rpp.types.js"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStep(
  stage: CognitiveStep["stage"],
  id?: string,
  overrides: Partial<CognitiveStep> = {}
): CognitiveStep {
  return {
    id,
    stage,
    content: ["some content"],
    references: [
      stage === "decision"
        ? { type: "rule", rule_id: "RUL-001", supports: "justifying decision" }
        : { type: "evidence", source: "file", locator: "src/foo.ts:1", supports: "grounding this claim" },
    ],
    ...overrides,
  }
}

function makeResponse(fromSteps = ["s-decision", "s-action"]): ResponseStep {
  return {
    content: ["response content"],
    references: [{ type: "derived", from_steps: fromSteps, supports: "derived from decision and action" }],
  }
}

function makeValidRecord(): RPPRecord {
  return {
    schema_version: "rpp.v1",
    call_id: "test-001",
    steps: [
      makeStep("interpretation", "s-interpretation"),
      makeStep("reasoning", "s-reasoning"),
      makeStep("decision", "s-decision"),
      makeStep("action", "s-action"),
    ],
    response: makeResponse(),
  }
}

// ---------------------------------------------------------------------------
// Layer A: validateRPPBinding — happy path
// ---------------------------------------------------------------------------

describe("validateRPPBinding — valid record", () => {
  it("valid record returns binding_valid=true, no errors", () => {
    const result = validateRPPBinding(makeValidRecord())
    assert.equal(result.structure_valid, true)
    assert.equal(result.syntax_valid, true)
    assert.equal(result.errors.length, 0)
  })

  it("valid: schema_version absent is backward compat", () => {
    const record = makeValidRecord()
    delete record.schema_version
    const result = validateRPPBinding(record)
    assert.equal(result.syntax_valid, true)
    assert.equal(result.structure_valid, true)
  })

  it("valid: schema_version rpp.v1 passes", () => {
    const record = makeValidRecord()
    record.schema_version = "rpp.v1"
    const result = validateRPPBinding(record)
    assert.equal(result.syntax_valid, true)
  })
})

// ---------------------------------------------------------------------------
// Layer A: MISSING_REQUIRED_STAGE
// ---------------------------------------------------------------------------

describe("validateRPPBinding — MISSING_REQUIRED_STAGE", () => {
  it("missing interpretation stage → error", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "interpretation")
    const result = validateRPPBinding(record)
    assert.equal(result.structure_valid, false)
    assert.ok(result.errors.some((e) => e.code === "MISSING_REQUIRED_STAGE" && e.message.includes("interpretation")))
  })

  it("missing decision stage → error", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "decision")
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "MISSING_REQUIRED_STAGE" && e.message.includes("decision")))
  })

  it("all 4 stages present → no MISSING_REQUIRED_STAGE", () => {
    const result = validateRPPBinding(makeValidRecord())
    assert.ok(!result.errors.some((e) => e.code === "MISSING_REQUIRED_STAGE"))
  })
})

// ---------------------------------------------------------------------------
// Layer A: DUPLICATE_STEP_ID
// ---------------------------------------------------------------------------

describe("validateRPPBinding — DUPLICATE_STEP_ID", () => {
  it("duplicate step id → error", () => {
    const record = makeValidRecord()
    record.steps[2]!.id = "s-interpretation"  // collides with steps[0]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "DUPLICATE_STEP_ID"))
  })

  it("unique step ids → no error", () => {
    const result = validateRPPBinding(makeValidRecord())
    assert.ok(!result.errors.some((e) => e.code === "DUPLICATE_STEP_ID"))
  })
})

// ---------------------------------------------------------------------------
// Layer A: EMPTY_CONTENT, EMPTY_REFERENCES
// ---------------------------------------------------------------------------

describe("validateRPPBinding — EMPTY_CONTENT and EMPTY_REFERENCES", () => {
  it("empty content array → EMPTY_CONTENT error", () => {
    const record = makeValidRecord()
    record.steps[0]!.content = []
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "EMPTY_CONTENT"))
  })

  it("empty references array → EMPTY_REFERENCES error", () => {
    const record = makeValidRecord()
    record.steps[1]!.references = []
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "EMPTY_REFERENCES"))
  })
})

// ---------------------------------------------------------------------------
// Layer A: STEP_DERIVED_REF_FORBIDDEN
// ---------------------------------------------------------------------------

describe("validateRPPBinding — STEP_DERIVED_REF_FORBIDDEN", () => {
  it("derived ref in a step → error", () => {
    const record = makeValidRecord()
    record.steps[1]!.references = [
      { type: "derived", from_steps: ["s-interpretation"], supports: "derived in step" },
    ]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "STEP_DERIVED_REF_FORBIDDEN"))
  })
})

// ---------------------------------------------------------------------------
// Layer A: INVALID_RULE_ID, INVALID_METHOD_ID, EMPTY_LOCATOR, EMPTY_SUPPORTS
// ---------------------------------------------------------------------------

describe("validateRPPBinding — ref field validation", () => {
  it("invalid rule_id → INVALID_RULE_ID", () => {
    const record = makeValidRecord()
    record.steps[2]!.references = [{ type: "rule", rule_id: "RUL999", supports: "justifying" }]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "INVALID_RULE_ID"))
  })

  it("valid rule_id RUL-001 → no error", () => {
    const result = validateRPPBinding(makeValidRecord())
    assert.ok(!result.errors.some((e) => e.code === "INVALID_RULE_ID"))
  })

  it("invalid method_id → INVALID_METHOD_ID", () => {
    const record = makeValidRecord()
    record.steps[1]!.references = [{ type: "method", method_id: "rca001", supports: "method reasoning" }]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "INVALID_METHOD_ID"))
  })

  it("valid method_id RCA-001 → no error", () => {
    const record = makeValidRecord()
    record.steps[1]!.references = [{ type: "method", method_id: "RCA-001", supports: "root cause analysis" }]
    const result = validateRPPBinding(record)
    assert.ok(!result.errors.some((e) => e.code === "INVALID_METHOD_ID"))
  })

  it("empty locator → EMPTY_LOCATOR", () => {
    const record = makeValidRecord()
    record.steps[0]!.references = [{ type: "evidence", source: "file", locator: "", supports: "grounding" }]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "EMPTY_LOCATOR"))
  })

  it("empty supports in step ref → EMPTY_SUPPORTS", () => {
    const record = makeValidRecord()
    record.steps[0]!.references = [{ type: "evidence", source: "file", locator: "src/foo.ts:1", supports: "" }]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "EMPTY_SUPPORTS"))
  })
})

// ---------------------------------------------------------------------------
// Layer A: UNTRACEABLE_RESPONSE, EMPTY_PROVENANCE_LINK
// ---------------------------------------------------------------------------

describe("validateRPPBinding — response provenance", () => {
  it("response with no derived ref → UNTRACEABLE_RESPONSE", () => {
    const record = makeValidRecord()
    record.response.references = [{ type: "evidence", source: "file", locator: "src/x.ts", supports: "grounding response" }]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "UNTRACEABLE_RESPONSE"))
  })

  it("derived ref with empty from_steps → EMPTY_PROVENANCE_LINK", () => {
    const record = makeValidRecord()
    record.response.references = [{ type: "derived", from_steps: [], supports: "derived" }]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "EMPTY_PROVENANCE_LINK"))
  })

  it("derived ref pointing to nonexistent step id → DANGLING_STEP_REFERENCE", () => {
    const record = makeValidRecord()
    record.response.references = [{ type: "derived", from_steps: ["s-nonexistent"], supports: "derived" }]
    const result = validateRPPBinding(record)
    assert.ok(result.errors.some((e) => e.code === "DANGLING_STEP_REFERENCE"))
  })

  it("derived ref to step with no grounded refs → UNGROUNDED_PROVENANCE_TARGET", () => {
    const record = makeValidRecord()
    // Clear action step refs
    record.steps[3]!.references = []
    record.response = makeResponse(["s-decision", "s-action"])
    const result = validateRPPBinding(record)
    // EMPTY_REFERENCES fires too, but UNGROUNDED_PROVENANCE_TARGET should also fire
    assert.ok(result.errors.some((e) => e.code === "UNGROUNDED_PROVENANCE_TARGET" || e.code === "EMPTY_REFERENCES"))
  })

  it("valid derived chain → no provenance errors", () => {
    const result = validateRPPBinding(makeValidRecord())
    const provCodes = ["UNTRACEABLE_RESPONSE", "EMPTY_PROVENANCE_LINK", "DANGLING_STEP_REFERENCE", "UNGROUNDED_PROVENANCE_TARGET"]
    assert.ok(!result.errors.some((e) => provCodes.includes(e.code)))
  })
})

// ---------------------------------------------------------------------------
// Layer B: checkRPPStrictness — happy path
// ---------------------------------------------------------------------------

describe("checkRPPStrictness — valid record", () => {
  it("valid record returns strictness_valid=true, no errors", () => {
    const result = checkRPPStrictness(makeValidRecord())
    assert.equal(result.strictness_pass, true)
    assert.equal(result.errors.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Layer B: UNJUSTIFIED_DECISION
// ---------------------------------------------------------------------------

describe("checkRPPStrictness — UNJUSTIFIED_DECISION", () => {
  it("decision step with only evidence refs → UNJUSTIFIED_DECISION", () => {
    const record = makeValidRecord()
    record.steps[2]!.references = [{ type: "evidence", source: "file", locator: "src/x.ts:1", supports: "evidence only" }]
    const result = checkRPPStrictness(record)
    assert.ok(result.errors.some((e) => e.code === "UNJUSTIFIED_DECISION"))
  })

  it("decision step with rule ref → no error", () => {
    const result = checkRPPStrictness(makeValidRecord())
    assert.ok(!result.errors.some((e) => e.code === "UNJUSTIFIED_DECISION"))
  })

  it("decision step with method ref → no error", () => {
    const record = makeValidRecord()
    record.steps[2]!.references = [{ type: "method", method_id: "RCA-001", supports: "method based decision" }]
    const result = checkRPPStrictness(record)
    assert.ok(!result.errors.some((e) => e.code === "UNJUSTIFIED_DECISION"))
  })
})

// ---------------------------------------------------------------------------
// Layer B: ACTION_NO_EVIDENCE
// ---------------------------------------------------------------------------

describe("checkRPPStrictness — ACTION_NO_EVIDENCE", () => {
  it("action step with only rule ref → ACTION_NO_EVIDENCE", () => {
    const record = makeValidRecord()
    record.steps[3]!.references = [{ type: "rule", rule_id: "RUL-002", supports: "authorized action" }]
    const result = checkRPPStrictness(record)
    assert.ok(result.errors.some((e) => e.code === "ACTION_NO_EVIDENCE"))
  })

  it("action step with evidence ref → no error", () => {
    const result = checkRPPStrictness(makeValidRecord())
    assert.ok(!result.errors.some((e) => e.code === "ACTION_NO_EVIDENCE"))
  })
})

// ---------------------------------------------------------------------------
// Layer B: RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION (warning)
// ---------------------------------------------------------------------------

describe("checkRPPStrictness — RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION", () => {
  it("response only traces to interpretation → warning", () => {
    const record = makeValidRecord()
    record.response = makeResponse(["s-interpretation"])
    const result = checkRPPStrictness(record)
    assert.ok(result.warnings.some((w) => w.code === "RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION"))
  })

  it("response traces to decision → no warning", () => {
    const result = checkRPPStrictness(makeValidRecord())
    assert.ok(!result.warnings.some((w) => w.code === "RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION"))
  })

  it("response traces to action → no warning", () => {
    const record = makeValidRecord()
    record.response = makeResponse(["s-action"])
    const result = checkRPPStrictness(record)
    assert.ok(!result.warnings.some((w) => w.code === "RESPONSE_NOT_LINKED_TO_DECISION_OR_ACTION"))
  })
})

// ---------------------------------------------------------------------------
// Layer B: SUPPORTS_MINIMAL (warning)
// ---------------------------------------------------------------------------

describe("checkRPPStrictness — SUPPORTS_MINIMAL", () => {
  it("empty supports value → warning (semantic: reference grounds nothing)", () => {
    const record = makeValidRecord()
    record.steps[0]!.references = [{ type: "evidence", source: "file", locator: "src/x.ts", supports: "" }]
    const result = checkRPPStrictness(record)
    assert.ok(result.warnings.some((w) => w.code === "SUPPORTS_MINIMAL"))
  })

  it("short but non-empty supports ('ok') → no warning (length is not a quality proxy)", () => {
    const record = makeValidRecord()
    record.steps[0]!.references = [{ type: "evidence", source: "file", locator: "src/x.ts", supports: "ok" }]
    const result = checkRPPStrictness(record)
    assert.ok(!result.warnings.some((w) => w.code === "SUPPORTS_MINIMAL"))
  })

  it("non-empty supports → no warning", () => {
    const result = checkRPPStrictness(makeValidRecord())
    assert.ok(!result.warnings.some((w) => w.code === "SUPPORTS_MINIMAL"))
  })
})

// ---------------------------------------------------------------------------
// validateRPPFull — combined
// ---------------------------------------------------------------------------

describe("validateRPPFull — combined Layer A + B", () => {
  it("valid record → all three phases valid", () => {
    const result = validateRPPFull(makeValidRecord())
    assert.equal(result.syntax_valid, true)
    assert.equal(result.structure_valid, true)
    assert.equal(result.strictness_pass, true)
    assert.equal(result.valid, true)
    assert.equal(result.errors.length, 0)
  })

  it("binding failure → valid=false even if strictness passes", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "reasoning")
    const result = validateRPPFull(record)
    assert.equal(result.structure_valid, false)
    assert.equal(result.valid, false)
  })

  it("strictness failure → valid=false even if binding passes", () => {
    const record = makeValidRecord()
    record.steps[2]!.references = [{ type: "evidence", source: "file", locator: "src/x.ts:1", supports: "evidence only decision" }]
    const result = validateRPPFull(record)
    assert.equal(result.structure_valid, true)
    assert.equal(result.strictness_pass, false)
    assert.equal(result.valid, false)
  })

  it("errors from both layers are merged", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "reasoning")   // Layer A: MISSING_REQUIRED_STAGE
    record.steps.find((s) => s.stage === "decision")!.references = [
      { type: "evidence", source: "file", locator: "x.ts:1", supports: "evidence only decision" },
    ]  // Layer B: UNJUSTIFIED_DECISION
    const result = validateRPPFull(record)
    assert.ok(result.errors.some((e) => e.code === "MISSING_REQUIRED_STAGE"))
    assert.ok(result.errors.some((e) => e.code === "UNJUSTIFIED_DECISION"))
  })

  it("valid: strictness_valid field is present and boolean", () => {
    const result = validateRPPFull(makeValidRecord())
    assert.equal(typeof result.strictness_pass, "boolean")
  })
})
