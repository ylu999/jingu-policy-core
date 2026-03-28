import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p4GlobalInvariants } from "../../src/policies/discipline/p4-global-invariants"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "fix bug" },
    proposal: { summary: "fix the bug", plannedActions: [] },
    ...overrides,
  }
}

describe("P4 — Global Invariants Over Local Progress", () => {
  it("returns no violations for clean proposal without quick-fix language", () => {
    const input = makeInput({
      proposal: {
        summary: "refactor authentication module to use proper token validation",
        plannedActions: [
          { type: "write", intent: "update auth logic" },
        ],
      },
    })
    const result = p4GlobalInvariants(input)
    assert.deepEqual(result, [])
  })

  it("rejects quick fix without follow-up plan", () => {
    const input = makeInput({
      proposal: {
        summary: "quick fix for the auth bug",
        plannedActions: [
          { type: "write", intent: "patch auth check" },
        ],
      },
    })
    const result = p4GlobalInvariants(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P4")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /quick.fix/i)
  })

  it("returns no violations when quick fix includes follow-up documentation", () => {
    const input = makeInput({
      proposal: {
        summary: "temporary workaround for auth bug",
        reasoning: "This is a short-term fix; a permanent fix is tracked in ticket JIRA-123 and will be addressed next sprint.",
        plannedActions: [
          { type: "write", intent: "apply workaround" },
        ],
      },
    })
    const result = p4GlobalInvariants(input)
    assert.deepEqual(result, [])
  })

  it("rejects workaround in action intent without follow-up", () => {
    const input = makeInput({
      proposal: {
        summary: "deploy new version",
        plannedActions: [
          { type: "command", intent: "apply workaround in production config" },
        ],
      },
    })
    const result = p4GlobalInvariants(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P4")
  })

  it("returns no violations for temporary fix with follow-up in reasoning", () => {
    const input = makeInput({
      proposal: {
        summary: "temporary patch",
        reasoning: "will be fixed properly in the long-term refactor scheduled for Q2",
        plannedActions: [],
      },
    })
    const result = p4GlobalInvariants(input)
    assert.deepEqual(result, [])
  })
})
