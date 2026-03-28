import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p3FailureClassification } from "../../src/policies/discipline/p3-failure-classification"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "fix failing test" },
    proposal: { summary: "retry", plannedActions: [] },
    ...overrides,
  }
}

describe("P3 — Failure Classification Before Retry", () => {
  it("returns no violations with no failure signals", () => {
    const input = makeInput({
      evidence: { failureSignals: [] },
    })
    const result = p3FailureClassification(input)
    assert.deepEqual(result, [])
  })

  it("returns no violations with only one same_failure signal", () => {
    const input = makeInput({
      evidence: { failureSignals: ["same_failure"] },
    })
    const result = p3FailureClassification(input)
    assert.deepEqual(result, [])
  })

  it("rejects when multiple same_failure signals and no new hypothesis", () => {
    const input = makeInput({
      evidence: { failureSignals: ["same_failure", "same_failure"] },
      proposal: {
        summary: "retry the same approach",
        plannedActions: [
          { type: "command", command: "npm test", intent: "run tests" },
        ],
      },
    })
    const result = p3FailureClassification(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P3")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /same_failure/)
  })

  it("returns no violations when multiple same_failure but new hypothesis provided", () => {
    const input = makeInput({
      evidence: { failureSignals: ["same_failure", "same_failure", "same_failure"] },
      proposal: {
        summary: "retry with new approach",
        plannedActions: [
          {
            type: "analysis",
            intent: "analyze logs",
            hypothesis: "The test is timing out due to network latency",
          },
          { type: "command", command: "npm test -- --timeout=10000", intent: "run tests with longer timeout" },
        ],
      },
    })
    const result = p3FailureClassification(input)
    assert.deepEqual(result, [])
  })

  it("rejects when 3 same_failure signals and actions have empty hypothesis", () => {
    const input = makeInput({
      evidence: { failureSignals: ["same_failure", "same_failure", "same_failure"] },
      proposal: {
        summary: "retry",
        plannedActions: [
          { type: "command", command: "npm test", intent: "run tests", hypothesis: "" },
        ],
      },
    })
    const result = p3FailureClassification(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P3")
    assert.equal(result[0].severity, "reject")
  })
})
