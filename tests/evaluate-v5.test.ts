import { strict as assert } from "node:assert"
import { test, describe } from "node:test"
import { evaluateV5, evaluateV5WithJudgement } from "../src/evaluate-v5"
import type { CoherenceJudge, CoherenceJudgeInput, CoherenceJudgeResult } from "../src/coherence-check"
import type { CoherenceJudgement, RichCoherenceJudge } from "../src/evaluate-v5"
import type { Input } from "../src/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validInput(): Input {
  return {
    task: { objective: "Fix discount calculation bug" },
    proposal: {
      summary: "Fix off-by-one in discount.ts",
      plannedActions: [
        { type: "read", intent: "read failing test", hypothesis: "off-by-one in loop boundary" },
        { type: "write", intent: "fix loop condition in discount.ts" },
      ],
    },
    evidence: {
      observations: ["test fails: expected 10 got 9", "verified connection pool config"],
      failureSignals: [],
    },
    reasoningFrame: {
      coreTension: "fix calculation without breaking edge cases vs minimal change",
      problemLayer: "execution",
      symptoms: ["Discount calculation returns wrong value for quantity=10"],
      hypotheses: ["Off-by-one error in loop boundary condition"],
      verifiedFacts: ["Test fails at quantity=10"],
      tradeoffs: ["minimal fix vs full refactor — prefer minimal to reduce blast radius"],
      proposedIntervention: "Change loop boundary condition from < to <= in discount.ts",
      nextStep: "Read the failing test output",
      rootCauseCandidate: "Loop boundary off-by-one",
    },
  }
}

// ─── Stub judges ─────────────────────────────────────────────────────────────

class CoherentJudge implements CoherenceJudge {
  async evaluate(_input: CoherenceJudgeInput): Promise<CoherenceJudgeResult> {
    return { verdict: "coherent" }
  }
}

class IncoherentJudge implements CoherenceJudge {
  async evaluate(_input: CoherenceJudgeInput): Promise<CoherenceJudgeResult> {
    return {
      verdict: "incoherent",
      reason: "hypothesis does not explain symptoms",
      severity: "reject",
    }
  }
}

class FailingJudge implements CoherenceJudge {
  async evaluate(_input: CoherenceJudgeInput): Promise<CoherenceJudgeResult> {
    throw new Error("LLM unavailable")
  }
}

class RichCoherentJudge implements RichCoherenceJudge {
  async evaluateRich(_input: CoherenceJudgeInput): Promise<CoherenceJudgement> {
    return { explains: true, targets: true, consistency: true, confidence: 0.9, issues: [] }
  }
}

class RichIncoherentJudge implements RichCoherenceJudge {
  constructor(private readonly judgement: Partial<CoherenceJudgement> = {}) {}
  async evaluateRich(_input: CoherenceJudgeInput): Promise<CoherenceJudgement> {
    return {
      explains: true,
      targets: true,
      consistency: true,
      confidence: 0.9,
      issues: [],
      ...this.judgement,
    }
  }
}

// ─── evaluateV5 tests ─────────────────────────────────────────────────────────

describe("evaluateV5 — no judge", () => {
  test("returns v4 result when no judge provided", async () => {
    const input = validInput()
    const result = await evaluateV5(input)
    assert.notEqual(result.stage, "semantic")
    assert.equal(result.stage, "regime")
  })
})

describe("evaluateV5 — with coherent judge", () => {
  test("returns v4 accept when judge confirms coherent", async () => {
    const input = validInput()
    const result = await evaluateV5(input, new CoherentJudge())
    assert.equal(result.stage, "regime")
    if (result.stage === "regime") {
      assert.equal(result.decision, "accept")
    }
  })
})

describe("evaluateV5 — with incoherent judge", () => {
  test("returns semantic reject when judge finds incoherence", async () => {
    const input = validInput()
    const result = await evaluateV5(input, new IncoherentJudge())
    assert.equal(result.stage, "semantic")
    if (result.stage === "semantic") {
      assert.equal(result.decision, "reject")
      assert.ok(result.summary.includes("semantic"))
    }
  })
})

describe("evaluateV5 — judge failure fallback", () => {
  test("falls back to v4 when judge throws", async () => {
    const input = validInput()
    const result = await evaluateV5(input, new FailingJudge())
    assert.notEqual(result.stage, "semantic")
  })
})

describe("evaluateV5 — hard stops bypass judge", () => {
  test("block from v4 not overridden by judge", async () => {
    const input = validInput()
    // inject a P3 blind retry block
    if (input.evidence) {
      input.evidence.failureSignals = ["same_failure", "same_failure"]
    }
    // Remove reasoningFrame so P16 triggers block
    input.evidence!.observations = []
    const result = await evaluateV5(input, new CoherentJudge())
    // Should still be regime result (block from v4, not semantic)
    assert.notEqual(result.stage, "semantic")
  })

  test("no reasoning frame skips judge", async () => {
    const input = validInput()
    delete input.reasoningFrame
    // this will fail reasoning gate → reasoning stage → bypass judge
    const result = await evaluateV5(input, new IncoherentJudge())
    assert.notEqual(result.stage, "semantic")
  })
})

// ─── evaluateV5WithJudgement tests ────────────────────────────────────────────

describe("evaluateV5WithJudgement — merge rules", () => {
  test("accept when all three flags true and confidence >= 0.6", async () => {
    const input = validInput()
    const result = await evaluateV5WithJudgement(input, new RichCoherentJudge())
    assert.notEqual(result.stage, "semantic")
    if (result.stage === "regime") assert.equal(result.decision, "accept")
  })

  test("reject when explains=false", async () => {
    const input = validInput()
    const result = await evaluateV5WithJudgement(input, new RichIncoherentJudge({ explains: false }))
    assert.equal(result.stage, "semantic")
    if (result.stage === "semantic") assert.equal(result.decision, "reject")
  })

  test("reject when targets=false", async () => {
    const input = validInput()
    const result = await evaluateV5WithJudgement(input, new RichIncoherentJudge({ targets: false }))
    assert.equal(result.stage, "semantic")
  })

  test("reject when consistency=false", async () => {
    const input = validInput()
    const result = await evaluateV5WithJudgement(input, new RichIncoherentJudge({ consistency: false }))
    assert.equal(result.stage, "semantic")
  })

  test("reject when confidence < 0.6", async () => {
    const input = validInput()
    const result = await evaluateV5WithJudgement(input, new RichIncoherentJudge({ confidence: 0.5 }))
    assert.equal(result.stage, "semantic")
    if (result.stage === "semantic") {
      assert.ok(result.summary.includes("0.50"))
    }
  })

  test("summary includes confidence score", async () => {
    const input = validInput()
    const result = await evaluateV5WithJudgement(input, new RichIncoherentJudge({ explains: false, confidence: 0.8, issues: ["hypothesis is vague"] }))
    assert.equal(result.stage, "semantic")
    if (result.stage === "semantic") {
      assert.ok(result.summary.includes("0.80"))
      assert.ok(result.summary.includes("hypothesis is vague"))
    }
  })
})
