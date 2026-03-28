import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p6BoundedExecution } from "../../src/policies/discipline/p6-bounded-execution"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "deploy" },
    proposal: { summary: "deploy infra", plannedActions: [] },
    ...overrides,
  }
}

describe("P6 — Bounded & Disciplined Execution", () => {
  it("returns no violations for balanced proposal", () => {
    const input = makeInput({
      proposal: {
        summary: "deploy",
        plannedActions: [
          { type: "read", intent: "read current state" },
          { type: "command", intent: "run plan" },
          { type: "analysis", intent: "review plan output" },
          { type: "command", intent: "apply" },
        ],
      },
    })
    const result = p6BoundedExecution(input)
    assert.deepEqual(result, [])
  })

  it("rejects when more than 5 consecutive write/command actions", () => {
    const input = makeInput({
      proposal: {
        summary: "deploy without checks",
        plannedActions: [
          { type: "command", intent: "step 1" },
          { type: "command", intent: "step 2" },
          { type: "write", intent: "step 3" },
          { type: "command", intent: "step 4" },
          { type: "write", intent: "step 5" },
          { type: "command", intent: "step 6" },
        ],
      },
    })
    const result = p6BoundedExecution(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P6")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /6/)
  })

  it("returns no violations for exactly 5 consecutive mutating actions", () => {
    const input = makeInput({
      proposal: {
        summary: "deploy",
        plannedActions: [
          { type: "command", intent: "step 1" },
          { type: "command", intent: "step 2" },
          { type: "write", intent: "step 3" },
          { type: "command", intent: "step 4" },
          { type: "write", intent: "step 5" },
          { type: "read", intent: "check result" },
        ],
      },
    })
    const result = p6BoundedExecution(input)
    assert.deepEqual(result, [])
  })

  it("resets counter on analysis action", () => {
    const input = makeInput({
      proposal: {
        summary: "deploy with mid-analysis",
        plannedActions: [
          { type: "command", intent: "s1" },
          { type: "command", intent: "s2" },
          { type: "command", intent: "s3" },
          { type: "analysis", intent: "mid-point check" },
          { type: "command", intent: "s4" },
          { type: "command", intent: "s5" },
          { type: "command", intent: "s6" },
        ],
      },
    })
    // Max consecutive is 3, which is within limit
    const result = p6BoundedExecution(input)
    assert.deepEqual(result, [])
  })
})
