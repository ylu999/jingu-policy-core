"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p3_failure_classification_1 = require("../../src/policies/discipline/p3-failure-classification");
function makeInput(overrides = {}) {
    return {
        task: { objective: "fix failing test" },
        proposal: { summary: "retry", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P3 — Failure Classification Before Retry", () => {
    (0, node_test_1.it)("returns no violations with no failure signals", () => {
        const input = makeInput({
            evidence: { failureSignals: [] },
        });
        const result = (0, p3_failure_classification_1.p3FailureClassification)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations with only one same_failure signal", () => {
        const input = makeInput({
            evidence: { failureSignals: ["same_failure"] },
        });
        const result = (0, p3_failure_classification_1.p3FailureClassification)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when multiple same_failure signals and no new hypothesis", () => {
        const input = makeInput({
            evidence: { failureSignals: ["same_failure", "same_failure"] },
            proposal: {
                summary: "retry the same approach",
                plannedActions: [
                    { type: "command", command: "npm test", intent: "run tests" },
                ],
            },
        });
        const result = (0, p3_failure_classification_1.p3FailureClassification)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P3");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /same_failure/);
    });
    (0, node_test_1.it)("returns no violations when multiple same_failure but new hypothesis provided", () => {
        const input = makeInput({
            evidence: { failureSignals: ["same_failure", "same_failure", "same_failure"] },
            proposal: {
                summary: "retry with new approach",
                plannedActions: [
                    {
                        type: "analysis",
                        intent: "analyze logs",
                        hypothesis: "The test is timing out due to network latency",
                    },
                    { type: "command", command: "npm test -- --timeout=10000", intent: "run tests with longer timeout" },
                ],
            },
        });
        const result = (0, p3_failure_classification_1.p3FailureClassification)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when 3 same_failure signals and actions have empty hypothesis", () => {
        const input = makeInput({
            evidence: { failureSignals: ["same_failure", "same_failure", "same_failure"] },
            proposal: {
                summary: "retry",
                plannedActions: [
                    { type: "command", command: "npm test", intent: "run tests", hypothesis: "" },
                ],
            },
        });
        const result = (0, p3_failure_classification_1.p3FailureClassification)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P3");
        strict_1.default.equal(result[0].severity, "reject");
    });
});
