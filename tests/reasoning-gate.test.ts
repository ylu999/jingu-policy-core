import { strict as assert } from "node:assert"
import { test } from "node:test"
import { enforceReasoningFrame } from "../src/reasoning-gate"

test("accept when complete reasoning frame provided", () => {
  const result = enforceReasoningFrame({
    reasoningFrame: {
      coreTension: "Must fix index calculation without breaking existing consumers",
      problemLayer: "execution",
      symptoms: ["test fails with off-by-one error", "output index is wrong"],
      hypotheses: ["off-by-one in index calculation", "wrong index boundary in loop"],
      verifiedFacts: ["confirmed via stack trace"],
      tradeoffs: ["minimal fix vs full refactor — prefer minimal to reduce blast radius"],
      proposedIntervention: "Fix index calculation on line 47 to use 0-based indexing",
      nextStep: "Read the failing test output first",
    },
  })
  assert.equal(result.decision, "accept")
})

test("reject when reasoningFrame missing entirely", () => {
  const result = enforceReasoningFrame({})
  assert.equal(result.decision, "reject")
  assert.ok("requiredFix" in result)
  if (result.decision === "reject") {
    assert.ok(result.requiredFix.length > 0)
  }
})

test("reject when coreTension too short", () => {
  const result = enforceReasoningFrame({
    reasoningFrame: {
      coreTension: "fix it",
      problemLayer: "execution",
      symptoms: ["broken"],
      hypotheses: ["bug"],
      verifiedFacts: [],
      tradeoffs: ["a vs b"],
      proposedIntervention: "change the code to work correctly",
      nextStep: "read the error",
    },
  })
  assert.equal(result.decision, "reject")
  if (result.decision === "reject") {
    assert.ok(result.reason.includes("tension"))
  }
})

test("reject when no hypotheses", () => {
  const result = enforceReasoningFrame({
    reasoningFrame: {
      coreTension: "Core tension is about correctness vs speed tradeoff",
      problemLayer: "execution",
      symptoms: ["broken"],
      hypotheses: [],
      verifiedFacts: [],
      tradeoffs: ["speed vs correctness"],
      proposedIntervention: "Fix the calculation logic properly",
      nextStep: "read the test",
    },
  })
  assert.equal(result.decision, "reject")
  if (result.decision === "reject") {
    assert.ok(result.reason.toLowerCase().includes("hypothes"))
  }
})

test("reject when no tradeoffs", () => {
  const result = enforceReasoningFrame({
    reasoningFrame: {
      coreTension: "Core tension is about correctness vs speed tradeoff",
      problemLayer: "execution",
      symptoms: ["broken"],
      hypotheses: ["bug in calculation"],
      verifiedFacts: [],
      tradeoffs: [],
      proposedIntervention: "Fix the calculation logic properly",
      nextStep: "read the test",
    },
  })
  assert.equal(result.decision, "reject")
  if (result.decision === "reject") {
    assert.ok(result.reason.includes("tradeoff"))
  }
})

test("reject when nextStep missing", () => {
  const result = enforceReasoningFrame({
    reasoningFrame: {
      coreTension: "Core tension is about correctness vs speed tradeoff",
      problemLayer: "execution",
      symptoms: ["broken"],
      hypotheses: ["bug"],
      verifiedFacts: [],
      tradeoffs: ["minimal vs full"],
      proposedIntervention: "Fix the calculation logic properly",
      nextStep: "",
    },
  })
  assert.equal(result.decision, "reject")
})

test("requiredFix contains actionable guidance", () => {
  const result = enforceReasoningFrame({})
  assert.equal(result.decision, "reject")
  assert.ok("requiredFix" in result)
  if (result.decision === "reject") {
    assert.ok(result.requiredFix.length > 0)
    assert.ok(result.requiredFix[0].length > 10)
  }
})

test("reject when proposedIntervention too short", () => {
  const result = enforceReasoningFrame({
    reasoningFrame: {
      coreTension: "Core tension is about correctness vs speed tradeoff",
      problemLayer: "execution",
      symptoms: ["broken"],
      hypotheses: ["bug"],
      verifiedFacts: [],
      tradeoffs: ["minimal vs full"],
      proposedIntervention: "fix",
      nextStep: "read the error output",
    },
  })
  assert.equal(result.decision, "reject")
  if (result.decision === "reject") {
    assert.ok(result.reason.includes("intervention"))
  }
})

test("reject accumulates multiple issues at once", () => {
  const result = enforceReasoningFrame({
    reasoningFrame: {
      coreTension: "fix",         // too short
      problemLayer: "unknown",    // not identified
      symptoms: [],
      hypotheses: [],             // missing
      verifiedFacts: [],
      tradeoffs: [],              // missing
      proposedIntervention: "x",  // too short
      nextStep: "",               // missing
    },
  })
  assert.equal(result.decision, "reject")
  if (result.decision === "reject") {
    // Multiple issues should be present
    assert.ok(result.reason.includes(";"))
    assert.ok(result.requiredFix.length >= 4)
  }
})
