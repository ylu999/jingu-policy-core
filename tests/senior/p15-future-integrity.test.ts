import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p15FutureIntegrity } from "../../src/policies/senior/p15-future-integrity"
import { Input, ReasoningFrame } from "../../src/types"

function makeFrame(overrides: Partial<ReasoningFrame> = {}): ReasoningFrame {
  return {
    coreTension: "Security vs developer velocity in secret management",
    problemLayer: "architecture",
    symptoms: ["secrets hardcoded in config files"],
    hypotheses: ["no secret management process defined"],
    verifiedFacts: ["API keys found in git history"],
    tradeoffs: ["convenience vs security"],
    proposedIntervention: "Migrate all secrets to Vault and rotate compromised keys",
    recurrencePrevention: "Add pre-commit hook to detect secrets, enforce secret scanning in CI",
    ...overrides,
  }
}

function makeInput(frame?: ReasoningFrame): Input {
  return {
    task: { objective: "fix secret leakage" },
    proposal: { summary: "migrate to vault", plannedActions: [] },
    reasoningFrame: frame,
  }
}

describe("P15 — Future-State Integrity", () => {
  it("returns no violations when no reasoningFrame provided", () => {
    const result = p15FutureIntegrity(makeInput())
    assert.deepEqual(result, [])
  })

  it("returns no violations when recurrencePrevention is documented", () => {
    const result = p15FutureIntegrity(makeInput(makeFrame()))
    assert.deepEqual(result, [])
  })

  it("warns when recurrencePrevention is not set", () => {
    const frameWithoutPrevention = makeFrame()
    delete frameWithoutPrevention.recurrencePrevention
    const result = p15FutureIntegrity(makeInput(frameWithoutPrevention))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P15")
    assert.equal(result[0].severity, "warning")
    assert.match(result[0].message, /recurrencePrevention/)
  })

  it("warns when recurrencePrevention is empty string", () => {
    const result = p15FutureIntegrity(makeInput(makeFrame({ recurrencePrevention: "" })))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P15")
    assert.equal(result[0].severity, "warning")
  })

  it("warns when recurrencePrevention is only whitespace", () => {
    const result = p15FutureIntegrity(makeInput(makeFrame({ recurrencePrevention: "   " })))
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P15")
    assert.equal(result[0].severity, "warning")
  })
})
