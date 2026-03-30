// src/rpp/rpp.validate.test.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { validateRPP } from "./rpp.validate.js"
import { RPPRecord, CognitiveStep, ResponseStep } from "./rpp.types.js"

function makeValidRecord(): RPPRecord {
  const interpretation: CognitiveStep = {
    id: "s-interpretation",
    stage: "interpretation",
    content: ["some claim about the system"],
    references: [
      {
        type: "evidence",
        source: "file",
        locator: "src/foo.ts:1",
        supports: "grounding this claim",
      },
    ],
  }
  const reasoning: CognitiveStep = {
    id: "s-reasoning",
    stage: "reasoning",
    content: ["some claim about the system"],
    references: [
      {
        type: "evidence",
        source: "file",
        locator: "src/foo.ts:1",
        supports: "grounding this claim",
      },
    ],
  }
  const decision: CognitiveStep = {
    id: "s-decision",
    stage: "decision",
    content: ["some claim about the system"],
    references: [
      {
        type: "rule",
        rule_id: "RUL-001",
        supports: "justifying this decision",
      },
    ],
  }
  const action: CognitiveStep = {
    id: "s-action",
    stage: "action",
    content: ["some claim about the system"],
    references: [
      {
        type: "evidence",
        source: "file",
        locator: "src/foo.ts:1",
        supports: "grounding this claim",
      },
    ],
  }
  const response: ResponseStep = {
    content: ["some claim about the system"],
    references: [
      {
        type: "derived",
        from_steps: ["s-decision", "s-action"],
        supports: "derived from decision and action steps above",
      },
    ],
  }
  return {
    call_id: "test-001",
    steps: [interpretation, reasoning, decision, action],
    response,
  }
}

describe("validateRPP — valid record", () => {
  it("valid record returns overall_status=valid with empty failures and warnings", () => {
    const record = makeValidRecord()
    const result = validateRPP(record)
    assert.equal(result.overall_status, "valid")
    assert.deepEqual(result.failures, [])
    assert.deepEqual(result.warnings, [])
  })
})

describe("validateRPP — MISSING_STAGE", () => {
  it("missing interpretation stage → MISSING_STAGE failure", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "interpretation")
    const result = validateRPP(record)
    const codes = result.failures.map((f) => f.code)
    assert.ok(codes.includes("MISSING_STAGE"), `expected MISSING_STAGE in failures, got ${JSON.stringify(codes)}`)
    const missing = result.failures.find((f) => f.code === "MISSING_STAGE" && f.stage === "interpretation")
    assert.ok(missing, "expected MISSING_STAGE for interpretation stage")
    assert.equal(result.overall_status, "invalid")
  })

  it("missing reasoning stage → MISSING_STAGE failure", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "reasoning")
    const result = validateRPP(record)
    const missing = result.failures.find((f) => f.code === "MISSING_STAGE" && f.stage === "reasoning")
    assert.ok(missing, "expected MISSING_STAGE for reasoning stage")
    assert.equal(result.overall_status, "invalid")
  })

  it("missing decision stage → MISSING_STAGE failure", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "decision")
    const result = validateRPP(record)
    const missing = result.failures.find((f) => f.code === "MISSING_STAGE" && f.stage === "decision")
    assert.ok(missing, "expected MISSING_STAGE for decision stage")
    assert.equal(result.overall_status, "invalid")
  })

  it("missing action stage → MISSING_STAGE failure", () => {
    const record = makeValidRecord()
    record.steps = record.steps.filter((s) => s.stage !== "action")
    const result = validateRPP(record)
    const missing = result.failures.find((f) => f.code === "MISSING_STAGE" && f.stage === "action")
    assert.ok(missing, "expected MISSING_STAGE for action stage")
    assert.equal(result.overall_status, "invalid")
  })
})

describe("validateRPP — EMPTY_CONTENT", () => {
  it("step with empty content array → EMPTY_CONTENT failure", () => {
    const record = makeValidRecord()
    const interpretStep = record.steps.find((s) => s.stage === "interpretation")!
    interpretStep.content = []
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "EMPTY_CONTENT" && f.stage === "interpretation")
    assert.ok(failure, "expected EMPTY_CONTENT failure for interpretation")
    assert.equal(result.overall_status, "invalid")
  })
})

describe("validateRPP — NO_REFERENCES", () => {
  it("step with empty references array → NO_REFERENCES failure", () => {
    const record = makeValidRecord()
    const actionStep = record.steps.find((s) => s.stage === "action")!
    actionStep.references = []
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "NO_REFERENCES" && f.stage === "action")
    assert.ok(failure, "expected NO_REFERENCES failure for action")
    assert.equal(result.overall_status, "invalid")
  })
})

describe("validateRPP — SUPPORTS_TOO_VAGUE", () => {
  it("empty supports string → SUPPORTS_TOO_VAGUE warning", () => {
    const record = makeValidRecord()
    const interpretStep = record.steps.find((s) => s.stage === "interpretation")!
    interpretStep.references[0].supports = ""
    const result = validateRPP(record)
    const warning = result.warnings.find((w) => w.code === "SUPPORTS_TOO_VAGUE" && w.stage === "interpretation")
    assert.ok(warning, "expected SUPPORTS_TOO_VAGUE warning for empty supports")
    assert.equal(result.overall_status, "weakly_supported")
  })

  it("supports shorter than 8 chars → SUPPORTS_TOO_VAGUE warning", () => {
    const record = makeValidRecord()
    const interpretStep = record.steps.find((s) => s.stage === "interpretation")!
    interpretStep.references[0].supports = "short" // 5 chars
    const result = validateRPP(record)
    const warning = result.warnings.find((w) => w.code === "SUPPORTS_TOO_VAGUE" && w.stage === "interpretation")
    assert.ok(warning, "expected SUPPORTS_TOO_VAGUE warning for supports shorter than 8 chars")
    assert.equal(result.overall_status, "weakly_supported")
  })

  it("supports exactly 8 chars → no SUPPORTS_TOO_VAGUE", () => {
    const record = makeValidRecord()
    const interpretStep = record.steps.find((s) => s.stage === "interpretation")!
    interpretStep.references[0].supports = "12345678" // exactly 8 chars
    const result = validateRPP(record)
    const warning = result.warnings.find((w) => w.code === "SUPPORTS_TOO_VAGUE")
    assert.equal(warning, undefined, "should not have SUPPORTS_TOO_VAGUE for supports >= 8 chars")
  })
})

describe("validateRPP — INVALID_REFERENCE", () => {
  it("rule ref with invalid rule_id format → INVALID_REFERENCE failure", () => {
    const record = makeValidRecord()
    const decisionStep = record.steps.find((s) => s.stage === "decision")!
    decisionStep.references = [{ type: "rule", rule_id: "debug-1", supports: "justifying this decision" }]
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "INVALID_REFERENCE" && f.stage === "decision")
    assert.ok(failure, "expected INVALID_REFERENCE for invalid rule_id")
    assert.equal(result.overall_status, "invalid")
  })

  it("method ref with invalid method_id format → INVALID_REFERENCE failure", () => {
    const record = makeValidRecord()
    const decisionStep = record.steps.find((s) => s.stage === "decision")!
    decisionStep.references = [{ type: "method", method_id: "rca001", supports: "justifying this decision" }]
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "INVALID_REFERENCE" && f.stage === "decision")
    assert.ok(failure, "expected INVALID_REFERENCE for invalid method_id")
    assert.equal(result.overall_status, "invalid")
  })

  it("evidence ref with empty source → INVALID_REFERENCE failure", () => {
    const record = makeValidRecord()
    const interpretStep = record.steps.find((s) => s.stage === "interpretation")!
    interpretStep.references = [{ type: "evidence", source: "", locator: "src/foo.ts:1", supports: "grounding this claim" }]
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "INVALID_REFERENCE" && f.stage === "interpretation")
    assert.ok(failure, "expected INVALID_REFERENCE for empty source")
    assert.equal(result.overall_status, "invalid")
  })

  it("evidence ref with empty locator → INVALID_REFERENCE failure", () => {
    const record = makeValidRecord()
    const interpretStep = record.steps.find((s) => s.stage === "interpretation")!
    interpretStep.references = [{ type: "evidence", source: "file", locator: "", supports: "grounding this claim" }]
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "INVALID_REFERENCE" && f.stage === "interpretation")
    assert.ok(failure, "expected INVALID_REFERENCE for empty locator")
    assert.equal(result.overall_status, "invalid")
  })
})

describe("validateRPP — UNJUSTIFIED_DECISION", () => {
  it("decision step with only evidence refs → UNJUSTIFIED_DECISION failure", () => {
    const record = makeValidRecord()
    const decisionStep = record.steps.find((s) => s.stage === "decision")!
    decisionStep.references = [
      { type: "evidence", source: "file", locator: "src/foo.ts:1", supports: "grounding this claim" },
    ]
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "UNJUSTIFIED_DECISION")
    assert.ok(failure, "expected UNJUSTIFIED_DECISION when decision has only evidence refs")
    assert.equal(result.overall_status, "invalid")
  })

  it("decision step with a rule ref → no UNJUSTIFIED_DECISION", () => {
    const record = makeValidRecord()
    // makeValidRecord already uses a rule ref in decision — verify no UNJUSTIFIED_DECISION
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "UNJUSTIFIED_DECISION")
    assert.equal(failure, undefined, "should not have UNJUSTIFIED_DECISION when rule ref present")
  })

  it("decision step with a method ref → no UNJUSTIFIED_DECISION", () => {
    const record = makeValidRecord()
    const decisionStep = record.steps.find((s) => s.stage === "decision")!
    decisionStep.references = [{ type: "method", method_id: "MTH-001", supports: "justifying this decision" }]
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "UNJUSTIFIED_DECISION")
    assert.equal(failure, undefined, "should not have UNJUSTIFIED_DECISION when method ref present")
  })
})

describe("validateRPP — INFERENCE_AS_FACT", () => {
  it("reasoning step with 'must be' and no evidence ref → INFERENCE_AS_FACT warning", () => {
    const record = makeValidRecord()
    const reasoningStep = record.steps.find((s) => s.stage === "reasoning")!
    reasoningStep.content = ["This must be the root cause of the failure"]
    reasoningStep.references = [{ type: "rule", rule_id: "RUL-001", supports: "some rule justification" }]
    const result = validateRPP(record)
    const warning = result.warnings.find((w) => w.code === "INFERENCE_AS_FACT")
    assert.ok(warning, "expected INFERENCE_AS_FACT warning when certainty language used without evidence ref")
  })

  it("reasoning step with 'must be' and evidence ref present → no INFERENCE_AS_FACT", () => {
    const record = makeValidRecord()
    const reasoningStep = record.steps.find((s) => s.stage === "reasoning")!
    reasoningStep.content = ["This must be the root cause of the failure"]
    // keep the existing evidence ref from makeValidRecord
    const result = validateRPP(record)
    const warning = result.warnings.find((w) => w.code === "INFERENCE_AS_FACT")
    assert.equal(warning, undefined, "should not have INFERENCE_AS_FACT when evidence ref is present")
  })
})

describe("validateRPP — UNTRACEABLE_RESPONSE", () => {
  it("response with no derived ref → UNTRACEABLE_RESPONSE failure", () => {
    const record = makeValidRecord()
    // Replace derived ref with an evidence ref — no structural link to prior steps
    record.response.references = [
      { type: "evidence", source: "file", locator: "src/foo.ts:1", supports: "grounding this claim" },
    ]
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "UNTRACEABLE_RESPONSE")
    assert.ok(failure, "expected UNTRACEABLE_RESPONSE for untraceable response content")
    assert.equal(result.overall_status, "invalid")
  })

  it("response with derived ref → no UNTRACEABLE_RESPONSE", () => {
    const record = makeValidRecord()
    // makeValidRecord already uses a derived ref in response — verify no UNTRACEABLE_RESPONSE
    const result = validateRPP(record)
    const failure = result.failures.find((f) => f.code === "UNTRACEABLE_RESPONSE")
    assert.equal(failure, undefined, "should not have UNTRACEABLE_RESPONSE when response has derived ref")
  })
})

describe("validateRPP — overall_status", () => {
  it("record with only soft failures → overall_status=weakly_supported", () => {
    const record = makeValidRecord()
    // Trigger only SUPPORTS_TOO_VAGUE (a warning/soft failure) on all steps
    for (const step of record.steps) {
      for (const ref of step.references) {
        ref.supports = ""
      }
    }
    const result = validateRPP(record)
    assert.equal(result.failures.length, 0, "should have no hard failures")
    assert.ok(result.warnings.length > 0, "should have at least one warning")
    assert.equal(result.overall_status, "weakly_supported")
  })

  it("record with mix of hard and soft failures → overall_status=invalid", () => {
    const record = makeValidRecord()
    // Trigger EMPTY_CONTENT (hard) on interpretation
    const interpretStep = record.steps.find((s) => s.stage === "interpretation")!
    interpretStep.content = []
    // Trigger SUPPORTS_TOO_VAGUE (soft) on reasoning
    const reasoningStep = record.steps.find((s) => s.stage === "reasoning")!
    reasoningStep.references[0].supports = ""
    const result = validateRPP(record)
    assert.ok(result.failures.length > 0, "should have at least one hard failure")
    assert.ok(result.warnings.length > 0, "should have at least one warning")
    assert.equal(result.overall_status, "invalid")
  })
})
