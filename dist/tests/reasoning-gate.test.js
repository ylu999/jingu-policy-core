"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const reasoning_gate_1 = require("../src/reasoning-gate");
(0, node_test_1.test)("accept when complete reasoning frame provided", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({
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
    });
    node_assert_1.strict.equal(result.decision, "accept");
});
(0, node_test_1.test)("reject when reasoningFrame missing entirely", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({});
    node_assert_1.strict.equal(result.decision, "reject");
    node_assert_1.strict.ok("requiredFix" in result);
    if (result.decision === "reject") {
        node_assert_1.strict.ok(result.requiredFix.length > 0);
    }
});
(0, node_test_1.test)("reject when coreTension too short", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({
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
    });
    node_assert_1.strict.equal(result.decision, "reject");
    if (result.decision === "reject") {
        node_assert_1.strict.ok(result.reason.includes("tension"));
    }
});
(0, node_test_1.test)("reject when no hypotheses", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({
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
    });
    node_assert_1.strict.equal(result.decision, "reject");
    if (result.decision === "reject") {
        node_assert_1.strict.ok(result.reason.toLowerCase().includes("hypothes"));
    }
});
(0, node_test_1.test)("reject when no tradeoffs", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({
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
    });
    node_assert_1.strict.equal(result.decision, "reject");
    if (result.decision === "reject") {
        node_assert_1.strict.ok(result.reason.includes("tradeoff"));
    }
});
(0, node_test_1.test)("reject when nextStep missing", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({
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
    });
    node_assert_1.strict.equal(result.decision, "reject");
});
(0, node_test_1.test)("requiredFix contains actionable guidance", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({});
    node_assert_1.strict.equal(result.decision, "reject");
    node_assert_1.strict.ok("requiredFix" in result);
    if (result.decision === "reject") {
        node_assert_1.strict.ok(result.requiredFix.length > 0);
        node_assert_1.strict.ok(result.requiredFix[0].length > 10);
    }
});
(0, node_test_1.test)("reject when proposedIntervention too short", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({
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
    });
    node_assert_1.strict.equal(result.decision, "reject");
    if (result.decision === "reject") {
        node_assert_1.strict.ok(result.reason.includes("intervention"));
    }
});
(0, node_test_1.test)("reject accumulates multiple issues at once", () => {
    const result = (0, reasoning_gate_1.enforceReasoningFrame)({
        reasoningFrame: {
            coreTension: "fix", // too short
            problemLayer: "unknown", // not identified
            symptoms: [],
            hypotheses: [], // missing
            verifiedFacts: [],
            tradeoffs: [], // missing
            proposedIntervention: "x", // too short
            nextStep: "", // missing
        },
    });
    node_assert_1.strict.equal(result.decision, "reject");
    if (result.decision === "reject") {
        // Multiple issues should be present
        node_assert_1.strict.ok(result.reason.includes(";"));
        node_assert_1.strict.ok(result.requiredFix.length >= 4);
    }
});
