import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p13Tradeoff } from "../../src/policies/senior/p13-tradeoff"
import { Input, ReasoningFrame } from "../../src/types"

function makeFrame(overrides: Partial<ReasoningFrame> = {}): ReasoningFrame {
  return {
    coreTension: "Cost vs availability for redundant storage",
    problemLayer: "architecture",
    symptoms: ["storage failures causing downtime"],
    hypotheses: ["single point of failure in storage"],
    verifiedFacts: ["no replication configured"],
    tradeoffs: ["higher cost for redundancy vs availability risk"],
    proposedIntervention: "Enable cross-region replication on critical buckets",
    ...overrides,
  }
}

function makeInput(frame?: ReasoningFrame): Input {
  return {
    task: { objective: "improve storage reliability" },
    proposal: { summary: "enable replication", plannedActions: [] },
    reasoningFrame: frame,
  }
}

describe("P13 — Tradeoff Awareness", () => {
  it("returns no violations when no reasoningFrame provided", () => {
    const result = p13Tradeoff(makeInput())
    assert.deepEqual(result, [])
  })

  it("returns no violations when tradeoffs are documented", () => {
    const result = p13Tradeoff(makeInput(makeFrame()))
    assert.deepEqual(result, [])
  })

  it("rejects when tradeoffs is empty array", () => {
    const result = p13Tradeoff(makeInput(makeFrame({ tradeoffs: [] })))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P13")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /tradeoffs/)
  })

  it("returns no violations with multiple tradeoffs", () => {
    const result = p13Tradeoff(
      makeInput(
        makeFrame({
          tradeoffs: [
            "higher cost vs availability",
            "complexity vs resilience",
            "latency vs consistency",
          ],
        })
      )
    )
    assert.deepEqual(result, [])
  })
})
