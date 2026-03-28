import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p8ClaimHonesty } from "../../src/policies/discipline/p8-claim-honesty"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "deploy" },
    proposal: { summary: "deploy", plannedActions: [] },
    ...overrides,
  }
}

describe("P8 — Claim Honesty", () => {
  it("returns no violations when no claim", () => {
    const input = makeInput()
    const result = p8ClaimHonesty(input)
    assert.deepEqual(result, [])
  })

  it("returns no violations when claim has no strong assertions", () => {
    const input = makeInput({
      claim: {
        statements: ["Deployment is in progress", "Resources are being provisioned"],
      },
    })
    const result = p8ClaimHonesty(input)
    assert.deepEqual(result, [])
  })

  it("rejects strong claim without command results", () => {
    const input = makeInput({
      claim: {
        statements: ["Deployment completed successfully"],
      },
      evidence: { commandResults: [] },
    })
    const result = p8ClaimHonesty(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P8")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /completed/)
  })

  it("returns no violations when strong claim is backed by evidence", () => {
    const input = makeInput({
      claim: {
        statements: ["Deployment completed successfully"],
      },
      evidence: {
        commandResults: ["Apply complete! Resources: 3 added, 0 changed, 0 destroyed."],
      },
    })
    const result = p8ClaimHonesty(input)
    assert.deepEqual(result, [])
  })

  it("rejects done claim with no evidence at all", () => {
    const input = makeInput({
      claim: {
        statements: ["All tests pass and the feature is done"],
      },
    })
    const result = p8ClaimHonesty(input)
    assert.equal(result.length >= 1, true)
    assert.equal(result[0].policyId, "P8")
    assert.equal(result[0].severity, "reject")
  })

  it("rejects multiple strong claim statements without evidence", () => {
    const input = makeInput({
      claim: {
        statements: ["Infrastructure successfully deployed", "All services done"],
      },
      evidence: { commandResults: undefined },
    })
    const result = p8ClaimHonesty(input)
    assert.equal(result.length, 2)
  })
})
