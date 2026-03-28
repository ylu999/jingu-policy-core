import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p2Preconditions } from "../../src/policies/discipline/p2-preconditions"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "deploy infrastructure" },
    proposal: { summary: "deploy", plannedActions: [] },
    ...overrides,
  }
}

describe("P2 — Preconditions Before Action", () => {
  it("returns no violations when no required tools defined", () => {
    const input = makeInput({
      evidence: { failureSignals: ["terraform_not_found"] },
    })
    const result = p2Preconditions(input)
    assert.deepEqual(result, [])
  })

  it("blocks when terraform_not_found signal and terraform is required", () => {
    const input = makeInput({
      task: {
        objective: "deploy",
        constraints: { requiredTools: ["terraform"] },
      },
      evidence: { failureSignals: ["terraform_not_found"] },
    })
    const result = p2Preconditions(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P2")
    assert.equal(result[0].severity, "block")
    assert.match(result[0].message, /terraform/)
  })

  it("blocks when missing_required_tool signal present", () => {
    const input = makeInput({
      task: {
        objective: "deploy",
        constraints: { requiredTools: ["kubectl"] },
      },
      evidence: { failureSignals: ["missing_required_tool: kubectl"] },
    })
    const result = p2Preconditions(input)
    assert.equal(result.length >= 1, true)
    assert.equal(result[0].policyId, "P2")
    assert.equal(result[0].severity, "block")
  })

  it("returns no violations when required tools are present (no failure signals)", () => {
    const input = makeInput({
      task: {
        objective: "deploy",
        constraints: { requiredTools: ["terraform"] },
      },
      evidence: { failureSignals: [] },
    })
    const result = p2Preconditions(input)
    assert.deepEqual(result, [])
  })

  it("blocks when missing_dependency signal present", () => {
    const input = makeInput({
      task: {
        objective: "build",
        constraints: { requiredTools: ["node"] },
      },
      evidence: { failureSignals: ["missing_dependency: node"] },
    })
    const result = p2Preconditions(input)
    assert.equal(result.length >= 1, true)
    assert.equal(result[0].policyId, "P2")
    assert.equal(result[0].severity, "block")
  })
})
