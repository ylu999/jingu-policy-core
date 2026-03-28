import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p12SymptomRootCause } from "../../src/policies/senior/p12-symptom-root-cause"
import { Input, ReasoningFrame } from "../../src/types"

function makeFrame(overrides: Partial<ReasoningFrame> = {}): ReasoningFrame {
  return {
    coreTension: "Reliability vs throughput in message queue",
    problemLayer: "execution",
    symptoms: ["messages are being dropped"],
    hypotheses: ["queue consumer is too slow"],
    verifiedFacts: ["consumer lag is increasing"],
    tradeoffs: ["throughput vs reliability"],
    proposedIntervention: "Scale consumers horizontally and add DLQ",
    ...overrides,
  }
}

function makeInput(frame?: ReasoningFrame): Input {
  return {
    task: { objective: "fix message queue" },
    proposal: { summary: "scale consumers", plannedActions: [] },
    reasoningFrame: frame,
  }
}

describe("P12 — Symptom vs Root Cause Separation", () => {
  it("returns no violations when no reasoningFrame provided", () => {
    const result = p12SymptomRootCause(makeInput())
    assert.deepEqual(result, [])
  })

  it("returns no violations for complete reasoning frame", () => {
    const result = p12SymptomRootCause(makeInput(makeFrame()))
    assert.deepEqual(result, [])
  })

  it("rejects when symptoms is empty", () => {
    const result = p12SymptomRootCause(makeInput(makeFrame({ symptoms: [] })))
    const symptomViolation = result.find((v) => v.message.includes("symptoms"))
    assert.ok(symptomViolation !== undefined, "expected a symptoms violation")
    assert.equal(symptomViolation!.policyId, "P12")
    assert.equal(symptomViolation!.severity, "reject")
  })

  it("rejects when hypotheses is empty", () => {
    const result = p12SymptomRootCause(makeInput(makeFrame({ hypotheses: [] })))
    const hypothesisViolation = result.find((v) => v.message.includes("hypotheses"))
    assert.ok(hypothesisViolation !== undefined, "expected a hypotheses violation")
    assert.equal(hypothesisViolation!.policyId, "P12")
    assert.equal(hypothesisViolation!.severity, "reject")
  })

  it("warns when verifiedFacts is empty", () => {
    const result = p12SymptomRootCause(makeInput(makeFrame({ verifiedFacts: [] })))
    const factViolation = result.find((v) => v.message.includes("verifiedFacts"))
    assert.ok(factViolation !== undefined, "expected a verifiedFacts warning")
    assert.equal(factViolation!.policyId, "P12")
    assert.equal(factViolation!.severity, "warning")
  })

  it("returns all three violations when all are empty", () => {
    const result = p12SymptomRootCause(
      makeInput(makeFrame({ symptoms: [], hypotheses: [], verifiedFacts: [] }))
    )
    assert.equal(result.length, 3)
    const severities = result.map((v) => v.severity)
    assert.ok(severities.includes("reject"))
    assert.ok(severities.includes("warning"))
  })
})
