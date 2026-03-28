import { strict as assert } from "node:assert"
import { test } from "node:test"
import { checkReasoningCoherence } from "../src/coherence-check"
import type { ReasoningFrame } from "../src/types"

// Base coherent frame to use as starting point for tests
const COHERENT_FRAME: ReasoningFrame = {
  coreTension: "Fix the index calculation without breaking existing consumers",
  problemLayer: "execution",
  symptoms: ["test fails with off-by-one error", "output array has wrong length"],
  hypotheses: ["off-by-one error in index calculation", "wrong length assumption in loop"],
  verifiedFacts: ["confirmed via stack trace at line 47"],
  rootCauseCandidate: "index calculation is using 1-based instead of 0-based indexing",
  tradeoffs: ["minimal fix vs full refactor — prefer minimal to reduce blast radius"],
  proposedIntervention: "Fix index calculation on line 47 to use 0-based indexing",
  nextStep: "Read the failing test output first",
}

// Test 1: coherent: true — complete and consistent reasoning frame
test("coherent: true — complete and consistent frame passes", () => {
  const result = checkReasoningCoherence(COHERENT_FRAME)
  assert.equal(result.coherent, true)
})

// Test 2: tension restatement — coreTension only restates goal, no conflict
test("warning: coreTension is goal restatement without conflict", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    coreTension: "Make the feature work correctly and completely",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const tensionIssue = result.issues.find(i => i.chain === "coreTension")
    assert.ok(tensionIssue, "should have a coreTension issue")
    assert.equal(tensionIssue!.severity, "warning")
    assert.ok(tensionIssue!.issue.includes("conflict") || tensionIssue!.issue.includes("restatement"))
  }
})

// Test 3: symptoms → hypotheses断裂 — hypotheses and symptoms completely unrelated
test("reject: hypotheses do not explain symptoms (keyword gap)", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    symptoms: ["database connection times out after 30 seconds"],
    hypotheses: ["the UI rendering logic has a memory leak"],
    // intervention intentionally left aligned to avoid check 4 triggering on top
    proposedIntervention: "Fix the UI rendering memory leak in component tree",
    rootCauseCandidate: "UI rendering memory leak causing component tree bloat",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const chainIssue = result.issues.find(i => i.chain === "symptoms → hypotheses")
    assert.ok(chainIssue, "should have a symptoms → hypotheses issue")
    assert.equal(chainIssue!.severity, "reject")
  }
})

// Test 4: intervention doesn't align with root cause
test("reject: intervention does not address root cause", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    hypotheses: ["network packet loss due to misconfigured firewall rules"],
    rootCauseCandidate: "firewall rules blocking outbound port 443",
    proposedIntervention: "Increase the database connection pool size",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const chainIssue = result.issues.find(i => i.chain === "hypotheses/rootCause → intervention")
    assert.ok(chainIssue, "should have a hypotheses/rootCause → intervention issue")
    assert.equal(chainIssue!.severity, "reject")
  }
})

// Test 5: tradeoff is not a real trade — only one side
test("warning: tradeoff does not describe two sides", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    tradeoffs: ["we should use the safer approach"],
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const tradeoffIssue = result.issues.find(i => i.chain === "tradeoffs")
    assert.ok(tradeoffIssue, "should have a tradeoffs issue")
    assert.equal(tradeoffIssue!.severity, "warning")
    assert.ok(tradeoffIssue!.issue.includes("trade"))
  }
})

// Test 6: nextStep is a goal not an action
test("warning: nextStep is a goal phrase rather than action verb", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    nextStep: "ensure system stability and correctness",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const nextStepIssue = result.issues.find(i => i.chain === "nextStep")
    assert.ok(nextStepIssue, "should have a nextStep issue")
    assert.equal(nextStepIssue!.severity, "warning")
    assert.ok(nextStepIssue!.issue.includes("action") || nextStepIssue!.issue.includes("verb"))
  }
})

// Test 7: good reasoning passes — all checks pass together
test("coherent: true — well-formed senior-level reasoning frame", () => {
  const frame: ReasoningFrame = {
    coreTension: "Apply targeted fix without introducing regression in downstream consumers",
    problemLayer: "execution",
    symptoms: [
      "test suite fails with AssertionError: expected 42 but got 43",
      "output array length is 1 greater than input",
    ],
    hypotheses: [
      "off-by-one in loop boundary allows one extra iteration",
      "array length check uses <= instead of <",
    ],
    verifiedFacts: [
      "stack trace points to src/utils/transform.ts line 23",
      "manual run confirms extra element appended",
    ],
    rootCauseCandidate: "loop uses <= length causing one extra iteration beyond array bounds",
    tradeoffs: ["fix boundary condition vs refactor loop logic — fix boundary to minimize diff scope"],
    proposedIntervention: "Change loop condition from <= to < on line 23 in transform.ts",
    nextStep: "Read src/utils/transform.ts lines 18-30 to confirm exact loop structure",
    recurrencePrevention: "Add a property-based test that verifies output.length === input.length",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, true)
})

// Test 8: multiple issues accumulate
test("coherent: false — multiple issues reported together", () => {
  const frame: ReasoningFrame = {
    coreTension: "Make everything work",                    // goal restatement
    problemLayer: "execution",
    symptoms: ["database connection fails"],
    hypotheses: ["UI rendering has memory leak"],           // unrelated to symptoms
    verifiedFacts: [],
    tradeoffs: ["use a simple approach"],                   // not a real trade
    proposedIntervention: "Fix the memory leak in React components",
    nextStep: "ensure system is stable",                    // goal not action
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    assert.ok(result.issues.length >= 3, `expected >= 3 issues, got ${result.issues.length}`)
  }
})

// Test 9: symptoms with causal statements trigger warning
test("warning: symptom starts with causal phrase", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    symptoms: ["because the index is wrong, tests fail"],
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const symptomIssue = result.issues.find(i => i.chain === "symptoms")
    assert.ok(symptomIssue, "should have a symptoms issue")
    assert.equal(symptomIssue!.severity, "warning")
  }
})

// Test 10: layer mismatch — requirements layer but execution symptoms
test("warning: problem layer 'requirements' but symptoms suggest execution issue", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    problemLayer: "requirements",
    symptoms: ["test fails with null pointer exception", "500 error on API call"],
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const layerIssue = result.issues.find(i => i.chain === "symptoms → problemLayer")
    assert.ok(layerIssue, "should have a symptoms → problemLayer issue")
    assert.equal(layerIssue!.severity, "warning")
  }
})
