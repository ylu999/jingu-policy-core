import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p14MinimalIntervention } from "../../src/policies/senior/p14-minimal-intervention"
import { Input, ReasoningFrame } from "../../src/types"

function makeFrame(overrides: Partial<ReasoningFrame> = {}): ReasoningFrame {
  return {
    coreTension: "Speed vs correctness in data migration",
    problemLayer: "execution",
    symptoms: ["migration script fails on large tables"],
    hypotheses: ["batch size too large causing OOM"],
    verifiedFacts: ["OOM error in migration logs"],
    tradeoffs: ["migration speed vs memory usage"],
    proposedIntervention: "Reduce batch size from 10000 to 1000 rows per transaction",
    ...overrides,
  }
}

function makeInput(frame?: ReasoningFrame): Input {
  return {
    task: { objective: "fix migration" },
    proposal: { summary: "reduce batch size", plannedActions: [] },
    reasoningFrame: frame,
  }
}

describe("P14 — Minimal Sufficient Intervention", () => {
  it("returns no violations when no reasoningFrame provided", () => {
    const result = p14MinimalIntervention(makeInput())
    assert.deepEqual(result, [])
  })

  it("returns no violations for well-described intervention", () => {
    const result = p14MinimalIntervention(makeInput(makeFrame()))
    assert.deepEqual(result, [])
  })

  it("rejects when proposedIntervention is too short", () => {
    const result = p14MinimalIntervention(makeInput(makeFrame({ proposedIntervention: "fix it" })))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P14")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /proposedIntervention/)
  })

  it("rejects when proposedIntervention is empty string", () => {
    const result = p14MinimalIntervention(makeInput(makeFrame({ proposedIntervention: "" })))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P14")
  })

  it("rejects when proposedIntervention is exactly 9 characters", () => {
    const result = p14MinimalIntervention(makeInput(makeFrame({ proposedIntervention: "123456789" })))
    assert.equal(result.length, 1)
  })

  it("returns no violations when proposedIntervention is exactly 10 characters", () => {
    const result = p14MinimalIntervention(makeInput(makeFrame({ proposedIntervention: "1234567890" })))
    assert.deepEqual(result, [])
  })
})
