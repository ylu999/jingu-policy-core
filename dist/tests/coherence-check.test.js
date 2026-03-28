"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const coherence_check_1 = require("../src/coherence-check");
// Base coherent frame to use as starting point for tests
const COHERENT_FRAME = {
    coreTension: "Fix the index calculation without breaking existing consumers",
    problemLayer: "execution",
    symptoms: ["test fails with off-by-one error", "output array has wrong length"],
    hypotheses: ["off-by-one error in index calculation", "wrong length assumption in loop"],
    verifiedFacts: ["confirmed via stack trace at line 47"],
    rootCauseCandidate: "index calculation is using 1-based instead of 0-based indexing",
    tradeoffs: ["minimal fix vs full refactor — prefer minimal to reduce blast radius"],
    proposedIntervention: "Fix index calculation on line 47 to use 0-based indexing",
    nextStep: "Read the failing test output first",
};
// Test 1: coherent: true — complete and consistent reasoning frame
(0, node_test_1.test)("coherent: true — complete and consistent frame passes", () => {
    const result = (0, coherence_check_1.checkReasoningCoherence)(COHERENT_FRAME);
    node_assert_1.strict.equal(result.coherent, true);
});
// Test 2: tension restatement — coreTension only restates goal, no conflict
(0, node_test_1.test)("warning: coreTension is goal restatement without conflict", () => {
    const frame = {
        ...COHERENT_FRAME,
        coreTension: "Make the feature work correctly and completely",
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        const tensionIssue = result.issues.find(i => i.chain === "coreTension");
        node_assert_1.strict.ok(tensionIssue, "should have a coreTension issue");
        node_assert_1.strict.equal(tensionIssue.severity, "warning");
        node_assert_1.strict.ok(tensionIssue.issue.includes("conflict") || tensionIssue.issue.includes("restatement"));
    }
});
// Test 3: symptoms → hypotheses断裂 — hypotheses and symptoms completely unrelated
(0, node_test_1.test)("reject: hypotheses do not explain symptoms (keyword gap)", () => {
    const frame = {
        ...COHERENT_FRAME,
        symptoms: ["database connection times out after 30 seconds"],
        hypotheses: ["the UI rendering logic has a memory leak"],
        // intervention intentionally left aligned to avoid check 4 triggering on top
        proposedIntervention: "Fix the UI rendering memory leak in component tree",
        rootCauseCandidate: "UI rendering memory leak causing component tree bloat",
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        const chainIssue = result.issues.find(i => i.chain === "symptoms → hypotheses");
        node_assert_1.strict.ok(chainIssue, "should have a symptoms → hypotheses issue");
        node_assert_1.strict.equal(chainIssue.severity, "reject");
    }
});
// Test 4: intervention doesn't align with root cause
(0, node_test_1.test)("reject: intervention does not address root cause", () => {
    const frame = {
        ...COHERENT_FRAME,
        hypotheses: ["network packet loss due to misconfigured firewall rules"],
        rootCauseCandidate: "firewall rules blocking outbound port 443",
        proposedIntervention: "Increase the database connection pool size",
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        const chainIssue = result.issues.find(i => i.chain === "hypotheses/rootCause → intervention");
        node_assert_1.strict.ok(chainIssue, "should have a hypotheses/rootCause → intervention issue");
        node_assert_1.strict.equal(chainIssue.severity, "reject");
    }
});
// Test 5: tradeoff is not a real trade — only one side
(0, node_test_1.test)("warning: tradeoff does not describe two sides", () => {
    const frame = {
        ...COHERENT_FRAME,
        tradeoffs: ["we should use the safer approach"],
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        const tradeoffIssue = result.issues.find(i => i.chain === "tradeoffs");
        node_assert_1.strict.ok(tradeoffIssue, "should have a tradeoffs issue");
        node_assert_1.strict.equal(tradeoffIssue.severity, "warning");
        node_assert_1.strict.ok(tradeoffIssue.issue.includes("trade"));
    }
});
// Test 6: nextStep is a goal not an action
(0, node_test_1.test)("warning: nextStep is a goal phrase rather than action verb", () => {
    const frame = {
        ...COHERENT_FRAME,
        nextStep: "ensure system stability and correctness",
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        const nextStepIssue = result.issues.find(i => i.chain === "nextStep");
        node_assert_1.strict.ok(nextStepIssue, "should have a nextStep issue");
        node_assert_1.strict.equal(nextStepIssue.severity, "warning");
        node_assert_1.strict.ok(nextStepIssue.issue.includes("action") || nextStepIssue.issue.includes("verb"));
    }
});
// Test 7: good reasoning passes — all checks pass together
(0, node_test_1.test)("coherent: true — well-formed senior-level reasoning frame", () => {
    const frame = {
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
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, true);
});
// Test 8: multiple issues accumulate
(0, node_test_1.test)("coherent: false — multiple issues reported together", () => {
    const frame = {
        coreTension: "Make everything work", // goal restatement
        problemLayer: "execution",
        symptoms: ["database connection fails"],
        hypotheses: ["UI rendering has memory leak"], // unrelated to symptoms
        verifiedFacts: [],
        tradeoffs: ["use a simple approach"], // not a real trade
        proposedIntervention: "Fix the memory leak in React components",
        nextStep: "ensure system is stable", // goal not action
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        node_assert_1.strict.ok(result.issues.length >= 3, `expected >= 3 issues, got ${result.issues.length}`);
    }
});
// Test 9: symptoms with causal statements trigger warning
(0, node_test_1.test)("warning: symptom starts with causal phrase", () => {
    const frame = {
        ...COHERENT_FRAME,
        symptoms: ["because the index is wrong, tests fail"],
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        const symptomIssue = result.issues.find(i => i.chain === "symptoms");
        node_assert_1.strict.ok(symptomIssue, "should have a symptoms issue");
        node_assert_1.strict.equal(symptomIssue.severity, "warning");
    }
});
// Test 10: layer mismatch — requirements layer but execution symptoms
(0, node_test_1.test)("warning: problem layer 'requirements' but symptoms suggest execution issue", () => {
    const frame = {
        ...COHERENT_FRAME,
        problemLayer: "requirements",
        symptoms: ["test fails with null pointer exception", "500 error on API call"],
    };
    const result = (0, coherence_check_1.checkReasoningCoherence)(frame);
    node_assert_1.strict.equal(result.coherent, false);
    if (!result.coherent) {
        const layerIssue = result.issues.find(i => i.chain === "symptoms → problemLayer");
        node_assert_1.strict.ok(layerIssue, "should have a symptoms → problemLayer issue");
        node_assert_1.strict.equal(layerIssue.severity, "warning");
    }
});
