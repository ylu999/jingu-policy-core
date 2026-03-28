import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p7Hygiene } from "../../src/policies/discipline/p7-hygiene"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "deploy" },
    proposal: { summary: "deploy", plannedActions: [] },
    ...overrides,
  }
}

describe("P7 — Hygiene Preservation", () => {
  it("returns no violations when no fileDiffSummary", () => {
    const input = makeInput({ evidence: {} })
    const result = p7Hygiene(input)
    assert.deepEqual(result, [])
  })

  it("blocks when sizeDelta exceeds 50MB", () => {
    const input = makeInput({
      evidence: {
        fileDiffSummary: {
          changedFiles: ["main.tf"],
          sizeDelta: 60_000_000,
        },
      },
    })
    const result = p7Hygiene(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P7")
    assert.equal(result[0].severity, "block")
    assert.match(result[0].message, /50 MB/)
  })

  it("blocks when .terraform directory is in changedFiles", () => {
    const input = makeInput({
      evidence: {
        fileDiffSummary: {
          changedFiles: [".terraform/providers/registry.terraform.io/hashicorp/aws/3.0.0/linux_amd64/terraform-provider-aws_v3.0.0"],
        },
      },
    })
    const result = p7Hygiene(input)
    assert.equal(result.length >= 1, true)
    assert.equal(result[0].policyId, "P7")
    assert.equal(result[0].severity, "block")
  })

  it("blocks when .tfstate file is in changedFiles", () => {
    const input = makeInput({
      evidence: {
        fileDiffSummary: {
          changedFiles: ["terraform.tfstate"],
        },
      },
    })
    const result = p7Hygiene(input)
    assert.equal(result.length >= 1, true)
    assert.equal(result[0].policyId, "P7")
    assert.equal(result[0].severity, "block")
  })

  it("blocks when largeFilesAdded > 0", () => {
    const input = makeInput({
      evidence: {
        fileDiffSummary: {
          changedFiles: [],
          largeFilesAdded: 2,
        },
      },
    })
    const result = p7Hygiene(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P7")
    assert.equal(result[0].severity, "block")
    assert.match(result[0].message, /2 large file/)
  })

  it("returns no violations for clean small changeset", () => {
    const input = makeInput({
      evidence: {
        fileDiffSummary: {
          changedFiles: ["main.tf", "variables.tf"],
          sizeDelta: 1024,
          largeFilesAdded: 0,
        },
      },
    })
    const result = p7Hygiene(input)
    assert.deepEqual(result, [])
  })
})
