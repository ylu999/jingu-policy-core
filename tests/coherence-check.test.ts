import { strict as assert } from "node:assert"
import { test } from "node:test"
import { checkReasoningCoherence } from "../src/coherence-check"
import type { ReasoningFrame } from "../src/types"

// Base coherent frame — uses mechanism objects in hypothesis + intervention alignment
const COHERENT_FRAME: ReasoningFrame = {
  coreTension: "Fix the index calculation without breaking existing consumers",
  problemLayer: "execution",
  symptoms: ["test fails with wrong output", "output array has unexpected length"],
  hypotheses: ["off-by-one error in loop boundary allows one extra iteration"],
  verifiedFacts: ["confirmed via stack trace at line 47"],
  rootCauseCandidate: "loop uses <= length causing one extra iteration beyond array bounds",
  tradeoffs: ["minimal fix vs full refactor — prefer minimal to reduce blast radius"],
  proposedIntervention: "Change loop condition from <= to < on line 47 to fix array bounds",
  nextStep: "Read src/utils/transform.ts lines 40-55 to confirm exact loop structure",
}

// Test 1: coherent frame passes all checks
test("coherent: true — complete and consistent frame passes", () => {
  const result = checkReasoningCoherence(COHERENT_FRAME)
  assert.equal(result.coherent, true, JSON.stringify(result))
})

// Test 2: tension restatement — warning
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
  }
})

// Test 3: hypothesis restatement of symptom — reject
// Key: hypothesis must not just reword the symptom; it must name a mechanism
test("reject: hypothesis restates symptom instead of proposing mechanism", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    symptoms: ["tests fail with wrong result", "output is incorrect"],
    hypotheses: ["tests fail because result is wrong", "output value is not correct"],  // pure restatement
    rootCauseCandidate: "the result is wrong",
    proposedIntervention: "Fix the wrong result in the test",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const chainIssue = result.issues.find(i =>
      i.chain === "symptoms → hypothesis" || i.chain === "hypothesis → mechanism"
    )
    assert.ok(chainIssue, `should have a hypothesis restatement or mechanism issue; got: ${JSON.stringify(result.issues)}`)
    assert.equal(chainIssue!.severity, "reject")
  }
})

// Test 4: hypothesis names mechanism but intervention targets different domain — reject
test("reject: intervention operates on different domain than hypothesis", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    hypotheses: ["firewall rules blocking outbound port 443"],
    rootCauseCandidate: "firewall blocking outbound network connection on port 443",
    proposedIntervention: "Increase the database connection pool max from 5 to 20",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const chainIssue = result.issues.find(i => i.chain === "hypothesis → intervention")
    assert.ok(chainIssue, `should have a hypothesis → intervention issue; got: ${JSON.stringify(result.issues)}`)
    assert.equal(chainIssue!.severity, "reject")
  }
})

// Test 5: tradeoff is not a real trade — warning
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

// Test 6: nextStep is a goal not an action — warning
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
  }
})

// Test 7: senior-level reasoning with DB pool example — must pass
// This is the key test: symptom is "500 errors + traffic spike", hypothesis is
// "connection pool exhausted" — the mechanism (pool) must be detected even though
// symptoms don't contain the word "pool"
test("coherent: true — DB pool exhaustion with 500 errors symptoms (the hard case)", () => {
  const frame: ReasoningFrame = {
    coreTension: "Eliminate 500 errors without hiding the actual failure or creating silent data loss",
    problemLayer: "architecture",
    symptoms: [
      "HTTP 500 errors on /api/users/profile",
      "Errors correlate with traffic spikes above 50 concurrent users",
    ],
    hypotheses: [
      "Database connection pool exhausted under concurrent load",
      "Query timeout under sustained load",
    ],
    verifiedFacts: [
      "Error message 'too many clients already' from PostgreSQL pg driver",
      "Pool configured with max=5, connections reach 5/5 exactly at error time",
    ],
    rootCauseCandidate: "Database connection pool max=5 is insufficient for concurrent load above 5 simultaneous requests",
    tradeoffs: [
      "Increase pool size vs add connection queuing — pool increase is simpler and addresses root cause directly",
      "Quick config fix vs full connection management refactor — config fix is appropriate here",
    ],
    proposedIntervention: "Increase database pool max connections from 5 to 20 in config/database.ts",
    recurrencePrevention: "Add connection pool monitoring alert when usage exceeds 80% capacity",
    nextStep: "Read config/database.ts to locate the pool max setting before making the change",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, true, `Expected coherent but got: ${JSON.stringify(result)}`)
})

// Test 8: multiple issues accumulate
test("coherent: false — multiple issues reported together", () => {
  const frame: ReasoningFrame = {
    coreTension: "Make everything work",                     // goal restatement → warning
    problemLayer: "execution",
    symptoms: ["database connection fails"],
    hypotheses: ["UI rendering has a rendering issue"],      // no mechanism object → reject
    verifiedFacts: [],
    tradeoffs: ["use a simple approach"],                    // no two sides → warning
    proposedIntervention: "Fix the rendering issue in React", // unaligned with DB symptom
    nextStep: "ensure system is stable",                     // goal not action → warning
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    assert.ok(result.issues.length >= 3, `expected >= 3 issues, got ${result.issues.length}: ${JSON.stringify(result.issues)}`)
  }
})

// Test 9: symptoms with causal statements trigger warning
test("warning: symptom starts with causal phrase", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    symptoms: ["because the loop boundary is wrong, tests fail"],
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

// Test 11: hypothesis no mechanism object — reject
// Pure hypothesis with no identifiable mechanism object
test("reject: hypothesis has no mechanism object", () => {
  const frame: ReasoningFrame = {
    ...COHERENT_FRAME,
    hypotheses: ["something is wrong with the system logic"],
    rootCauseCandidate: "the logic is incorrect",
    proposedIntervention: "Fix the incorrect logic in the system",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, false)
  if (!result.coherent) {
    const mechIssue = result.issues.find(i =>
      i.chain === "hypothesis → mechanism" || i.chain === "symptoms → hypothesis"
    )
    assert.ok(mechIssue, `should have a mechanism issue; got: ${JSON.stringify(result.issues)}`)
    assert.equal(mechIssue!.severity, "reject")
  }
})

// Test 12: memory leak hypothesis — mechanism present, intervention aligned
test("coherent: true — memory leak hypothesis with intervention on memory", () => {
  const frame: ReasoningFrame = {
    coreTension: "Fix memory leak without changing component API contract",
    problemLayer: "execution",
    symptoms: [
      "Process memory grows unbounded over time",
      "OOM crash after 24 hours of runtime",
    ],
    hypotheses: [
      "Memory leak in event listener registration — listeners attached but never removed",
    ],
    verifiedFacts: [
      "heap snapshot shows growing listener count",
      "removeEventListener call missing in cleanup",
    ],
    rootCauseCandidate: "Memory leak: event listeners accumulate because cleanup never calls removeEventListener",
    tradeoffs: [
      "Fix cleanup in one component vs audit all components — fix known leak first, then audit",
    ],
    proposedIntervention: "Add removeEventListener call in component cleanup to free memory",
    nextStep: "Inspect the component lifecycle cleanup method to confirm missing removeEventListener",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, true, `Expected coherent but got: ${JSON.stringify(result)}`)
})

// Test 13: off-by-one hypothesis — classic pattern must pass
test("coherent: true — off-by-one hypothesis with intervention on index/boundary", () => {
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
    ],
    rootCauseCandidate: "loop uses <= length causing one extra iteration beyond array bounds",
    tradeoffs: ["fix boundary condition vs refactor loop logic — fix boundary to minimize diff scope"],
    proposedIntervention: "Change loop condition from <= to < on line 23 in transform.ts",
    nextStep: "Read src/utils/transform.ts lines 18-30 to confirm exact loop structure",
  }
  const result = checkReasoningCoherence(frame)
  assert.equal(result.coherent, true, `Expected coherent but got: ${JSON.stringify(result)}`)
})
