import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p10CoreTension } from "../../src/policies/senior/p10-core-tension"
import { Input, ReasoningFrame } from "../../src/types"

function makeFrame(overrides: Partial<ReasoningFrame> = {}): ReasoningFrame {
  return {
    coreTension: "Speed vs reliability in deployment pipeline",
    problemLayer: "execution",
    symptoms: ["deployment fails intermittently"],
    hypotheses: ["race condition in deploy script"],
    verifiedFacts: ["CI logs show timeout errors"],
    tradeoffs: ["faster deploy vs stability"],
    proposedIntervention: "Add retry logic with exponential backoff",
    ...overrides,
  }
}

function makeInput(frame?: ReasoningFrame): Input {
  return {
    task: { objective: "fix deployment" },
    proposal: { summary: "fix deploy", plannedActions: [] },
    reasoningFrame: frame,
  }
}

describe("P10 — Core Tension First", () => {
  it("returns no violations when no reasoningFrame provided", () => {
    const result = p10CoreTension(makeInput())
    assert.deepEqual(result, [])
  })

  it("returns no violations when coreTension is sufficiently long", () => {
    const result = p10CoreTension(makeInput(makeFrame()))
    assert.deepEqual(result, [])
  })

  it("rejects when coreTension is too short", () => {
    const result = p10CoreTension(makeInput(makeFrame({ coreTension: "short" })))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P10")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /coreTension/)
  })

  it("rejects when coreTension is empty string", () => {
    const result = p10CoreTension(makeInput(makeFrame({ coreTension: "" })))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P10")
    assert.equal(result[0].severity, "reject")
  })

  it("rejects when coreTension is exactly 9 characters (below minimum of 10)", () => {
    const result = p10CoreTension(makeInput(makeFrame({ coreTension: "123456789" })))
    assert.equal(result.length, 1)
  })

  it("returns no violations when coreTension is exactly 10 characters", () => {
    const result = p10CoreTension(makeInput(makeFrame({ coreTension: "1234567890" })))
    assert.deepEqual(result, [])
  })
})
