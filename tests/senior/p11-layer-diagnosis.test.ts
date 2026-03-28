import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p11LayerDiagnosis } from "../../src/policies/senior/p11-layer-diagnosis"
import { Input, ReasoningFrame, ProblemLayer } from "../../src/types"

function makeFrame(problemLayer: ProblemLayer): ReasoningFrame {
  return {
    coreTension: "Correctness vs performance in data pipeline",
    problemLayer,
    symptoms: ["slow query"],
    hypotheses: ["missing index"],
    verifiedFacts: ["query plan shows full scan"],
    tradeoffs: ["index write overhead vs read speed"],
    proposedIntervention: "Add composite index on (user_id, created_at)",
  }
}

function makeInput(frame?: ReasoningFrame): Input {
  return {
    task: { objective: "optimize query" },
    proposal: { summary: "add index", plannedActions: [] },
    reasoningFrame: frame,
  }
}

describe("P11 — Correct Layer Diagnosis", () => {
  it("returns no violations when no reasoningFrame provided", () => {
    const result = p11LayerDiagnosis(makeInput())
    assert.deepEqual(result, [])
  })

  it("rejects when problemLayer is unknown", () => {
    const result = p11LayerDiagnosis(makeInput(makeFrame("unknown")))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P11")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /unknown/)
  })

  it("returns no violations for execution layer", () => {
    const result = p11LayerDiagnosis(makeInput(makeFrame("execution")))
    assert.deepEqual(result, [])
  })

  it("returns no violations for architecture layer", () => {
    const result = p11LayerDiagnosis(makeInput(makeFrame("architecture")))
    assert.deepEqual(result, [])
  })

  it("returns no violations for requirements layer", () => {
    const result = p11LayerDiagnosis(makeInput(makeFrame("requirements")))
    assert.deepEqual(result, [])
  })

  it("returns no violations for environment layer", () => {
    const result = p11LayerDiagnosis(makeInput(makeFrame("environment")))
    assert.deepEqual(result, [])
  })

  it("returns no violations for state layer", () => {
    const result = p11LayerDiagnosis(makeInput(makeFrame("state")))
    assert.deepEqual(result, [])
  })
})
