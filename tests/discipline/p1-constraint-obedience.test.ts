import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p1ConstraintObedience } from "../../src/policies/discipline/p1-constraint-obedience"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "deploy infrastructure" },
    proposal: { summary: "deploy with terraform", plannedActions: [] },
    ...overrides,
  }
}

describe("P1 — Constraint Obedience", () => {
  it("returns no violations when no constraints defined", () => {
    const input = makeInput({
      proposal: {
        summary: "deploy",
        plannedActions: [
          { type: "command", command: "aws ec2 create-instance", intent: "create EC2" },
        ],
      },
    })
    const result = p1ConstraintObedience(input)
    assert.deepEqual(result, [])
  })

  it("rejects action that violates terraform_only constraint", () => {
    const input = makeInput({
      task: {
        objective: "deploy",
        constraints: { explicitConstraints: ["terraform_only"] },
      },
      proposal: {
        summary: "deploy via aws cli",
        plannedActions: [
          { type: "command", command: "aws ec2 create-instance", intent: "create EC2 instance" },
        ],
      },
    })
    const result = p1ConstraintObedience(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P1")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /terraform_only/)
  })

  it("returns no violations when terraform_only constraint is respected", () => {
    const input = makeInput({
      task: {
        objective: "deploy",
        constraints: { explicitConstraints: ["terraform_only"] },
      },
      proposal: {
        summary: "deploy via terraform",
        plannedActions: [
          { type: "command", command: "terraform apply", intent: "apply terraform plan" },
        ],
      },
    })
    const result = p1ConstraintObedience(input)
    assert.deepEqual(result, [])
  })

  it("returns violation for no_write constraint when write action present", () => {
    const input = makeInput({
      task: {
        objective: "read only task",
        constraints: { explicitConstraints: ["no_write"] },
      },
      proposal: {
        summary: "write config file",
        plannedActions: [
          { type: "write", intent: "write config" },
        ],
      },
    })
    const result = p1ConstraintObedience(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P1")
    assert.equal(result[0].severity, "reject")
  })

  it("returns violation for read_only constraint when command action present", () => {
    const input = makeInput({
      task: {
        objective: "read only task",
        constraints: { explicitConstraints: ["read_only"] },
      },
      proposal: {
        summary: "run command",
        plannedActions: [
          { type: "command", command: "rm -rf /tmp/test", intent: "clean up" },
        ],
      },
    })
    const result = p1ConstraintObedience(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P1")
  })

  it("multiple violations for multiple violating actions", () => {
    const input = makeInput({
      task: {
        objective: "deploy",
        constraints: { explicitConstraints: ["terraform_only"] },
      },
      proposal: {
        summary: "deploy via aws cli",
        plannedActions: [
          { type: "command", command: "aws ec2 create-instance", intent: "create EC2" },
          { type: "command", command: "gcloud compute instances create", intent: "create GCE" },
        ],
      },
    })
    const result = p1ConstraintObedience(input)
    assert.equal(result.length, 2)
  })
})
