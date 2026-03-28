import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { p9HypothesisSearch } from "../../src/policies/discipline/p9-hypothesis-search"
import { Input } from "../../src/types"

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "debug issue" },
    proposal: { summary: "investigate", plannedActions: [] },
    ...overrides,
  }
}

describe("P9 — Hypothesis-Driven Search", () => {
  it("returns no violations when no search actions", () => {
    const input = makeInput({
      proposal: {
        summary: "fix bug",
        plannedActions: [
          { type: "read", intent: "read logs" },
          { type: "analysis", intent: "analyze logs" },
        ],
      },
    })
    const result = p9HypothesisSearch(input)
    assert.deepEqual(result, [])
  })

  it("rejects search action without hypothesis", () => {
    const input = makeInput({
      proposal: {
        summary: "search for root cause",
        plannedActions: [
          { type: "search", query: "error logs", intent: "find errors in logs" },
        ],
      },
    })
    const result = p9HypothesisSearch(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P9")
    assert.equal(result[0].severity, "reject")
    assert.match(result[0].message, /hypothesis/)
  })

  it("returns no violations when search action has hypothesis", () => {
    const input = makeInput({
      proposal: {
        summary: "search with hypothesis",
        plannedActions: [
          {
            type: "search",
            query: "OOM error",
            intent: "find memory-related errors",
            hypothesis: "The service is crashing due to memory exhaustion under high load",
          },
        ],
      },
    })
    const result = p9HypothesisSearch(input)
    assert.deepEqual(result, [])
  })

  it("rejects search with empty string hypothesis", () => {
    const input = makeInput({
      proposal: {
        summary: "search",
        plannedActions: [
          { type: "search", intent: "look for issues", hypothesis: "   " },
        ],
      },
    })
    const result = p9HypothesisSearch(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].policyId, "P9")
  })

  it("returns violations only for search actions, not other types", () => {
    const input = makeInput({
      proposal: {
        summary: "mixed actions",
        plannedActions: [
          { type: "read", intent: "read file" }, // ok - not search
          { type: "search", intent: "find pattern" }, // no hypothesis - violation
          { type: "search", intent: "locate config", hypothesis: "Config is in /etc" }, // ok
        ],
      },
    })
    const result = p9HypothesisSearch(input)
    assert.equal(result.length, 1)
    assert.match(result[0].message, /find pattern/)
  })
})
