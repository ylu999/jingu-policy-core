"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const p16_externalize_context_1 = require("../../src/policies/senior/p16-externalize-context");
const baseTask = {
    objective: "Fix the broken service",
    constraints: {},
};
(0, node_test_1.test)("P16: no violation when context is externalized before action", () => {
    const input = {
        task: baseTask,
        proposal: {
            summary: "Fix the issue",
            plannedActions: [
                { type: "write", intent: "apply fix" }
            ],
        },
        evidence: {
            observations: ["Updated .jingu/context/active-task.md with current findings"],
            commandResults: ["verified: root cause confirmed"],
        },
        reasoningFrame: {
            coreTension: "Fix service without breaking downstream consumers",
            problemLayer: "execution",
            symptoms: ["service returns 500"],
            hypotheses: ["null pointer in handler"],
            verifiedFacts: ["stack trace confirms NPE at line 47"],
            tradeoffs: ["minimal fix vs full refactor"],
            proposedIntervention: "add null check at line 47",
            recurrencePrevention: "add unit test for null input",
        },
    };
    const violations = (0, p16_externalize_context_1.p16ExternalizeContext)(input);
    node_assert_1.strict.equal(violations.length, 0);
});
(0, node_test_1.test)("P16: reject when write action proposed with no context reference", () => {
    const input = {
        task: baseTask,
        proposal: {
            summary: "Just change the file",
            plannedActions: [
                { type: "write", intent: "modify config" }
            ],
        },
        evidence: {},
    };
    const violations = (0, p16_externalize_context_1.p16ExternalizeContext)(input);
    node_assert_1.strict.ok(violations.some(v => v.policyId === "P16" && v.severity === "reject"));
});
(0, node_test_1.test)("P16: reject on retry without context update", () => {
    const input = {
        task: baseTask,
        proposal: {
            summary: "Try again",
            plannedActions: [
                { type: "command", command: "npm test", intent: "retry" }
            ],
        },
        evidence: {
            failureSignals: ["same_failure", "same_failure", "same_failure"],
        },
    };
    const violations = (0, p16_externalize_context_1.p16ExternalizeContext)(input);
    node_assert_1.strict.ok(violations.some(v => v.policyId === "P16" && v.severity === "reject"));
});
(0, node_test_1.test)("P16: reject on completion claim without evidence summary", () => {
    const input = {
        task: baseTask,
        proposal: {
            summary: "Done",
            plannedActions: [],
        },
        claim: {
            statements: ["Issue has been resolved and service is now stable"],
        },
        evidence: {},
    };
    const violations = (0, p16_externalize_context_1.p16ExternalizeContext)(input);
    node_assert_1.strict.ok(violations.some(v => v.policyId === "P16" && v.severity === "reject"));
});
(0, node_test_1.test)("P16: warning on hollow reasoning frame", () => {
    const input = {
        task: baseTask,
        proposal: {
            summary: "Try something",
            plannedActions: [{ type: "analysis", intent: "look around" }],
        },
        reasoningFrame: {
            coreTension: "",
            problemLayer: "unknown",
            symptoms: [],
            hypotheses: [],
            verifiedFacts: [],
            tradeoffs: [],
            proposedIntervention: "",
        },
    };
    const violations = (0, p16_externalize_context_1.p16ExternalizeContext)(input);
    node_assert_1.strict.ok(violations.some(v => v.policyId === "P16" && v.severity === "warning"));
});
