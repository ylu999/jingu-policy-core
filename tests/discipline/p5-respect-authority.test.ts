import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p5RespectAuthority } from "../../src/policies/discipline/p5-respect-authority"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "update feature" },
    proposal: { summary: "update feature flag", plannedActions: [] },
    ...overrides,
  }
}

describe("P5 — Respect Authority & Boundaries", () => {
  it("returns no violations for normal action", () => {
    const input = makeInput({
      proposal: {
        summary: "add feature",
        plannedActions: [
          { type: "write", intent: "add new endpoint to API" },
        ],
      },
    })
    const result = p5RespectAuthority(input)
    assert.deepEqual(result, [])
  })

  it("rejects action with bypass intent", () => {
    const input = makeInput({
      proposal: {
        summary: "deploy",
        plannedActions: [
          { type: "command", intent: "bypass authentication to speed up deployment" },
        ],
      },
    })
    const result = p5RespectAuthority(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P5")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /bypass/)
  })

  it("rejects action that attempts to replace authority", () => {
    const input = makeInput({
      proposal: {
        summary: "overhaul auth",
        plannedActions: [
          { type: "write", intent: "replace authority module with custom implementation" },
        ],
      },
    })
    const result = p5RespectAuthority(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P5")
    assert.equal(result[0].severity, "reject")
  })

  it("rejects action with change architecture intent", () => {
    const input = makeInput({
      proposal: {
        summary: "refactor",
        plannedActions: [
          { type: "write", intent: "change architecture of the authorization service" },
        ],
      },
    })
    const result = p5RespectAuthority(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P5")
  })

  it("returns multiple violations for multiple offending actions", () => {
    const input = makeInput({
      proposal: {
        summary: "overhaul",
        plannedActions: [
          { type: "command", intent: "bypass approval gate" },
          { type: "write", intent: "circumvent the rate limiter" },
        ],
      },
    })
    const result = p5RespectAuthority(input)
    assert.equal(result.length, 2)
  })
})
