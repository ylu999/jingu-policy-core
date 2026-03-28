"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p6_bounded_execution_1 = require("../../src/policies/discipline/p6-bounded-execution");
function makeInput(overrides = {}) {
    return {
        task: { objective: "deploy" },
        proposal: { summary: "deploy infra", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P6 — Bounded & Disciplined Execution", () => {
    (0, node_test_1.it)("returns no violations for balanced proposal", () => {
        const input = makeInput({
            proposal: {
                summary: "deploy",
                plannedActions: [
                    { type: "read", intent: "read current state" },
                    { type: "command", intent: "run plan" },
                    { type: "analysis", intent: "review plan output" },
                    { type: "command", intent: "apply" },
                ],
            },
        });
        const result = (0, p6_bounded_execution_1.p6BoundedExecution)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when more than 5 consecutive write/command actions", () => {
        const input = makeInput({
            proposal: {
                summary: "deploy without checks",
                plannedActions: [
                    { type: "command", intent: "step 1" },
                    { type: "command", intent: "step 2" },
                    { type: "write", intent: "step 3" },
                    { type: "command", intent: "step 4" },
                    { type: "write", intent: "step 5" },
                    { type: "command", intent: "step 6" },
                ],
            },
        });
        const result = (0, p6_bounded_execution_1.p6BoundedExecution)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P6");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /6/);
    });
    (0, node_test_1.it)("returns no violations for exactly 5 consecutive mutating actions", () => {
        const input = makeInput({
            proposal: {
                summary: "deploy",
                plannedActions: [
                    { type: "command", intent: "step 1" },
                    { type: "command", intent: "step 2" },
                    { type: "write", intent: "step 3" },
                    { type: "command", intent: "step 4" },
                    { type: "write", intent: "step 5" },
                    { type: "read", intent: "check result" },
                ],
            },
        });
        const result = (0, p6_bounded_execution_1.p6BoundedExecution)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("resets counter on analysis action", () => {
        const input = makeInput({
            proposal: {
                summary: "deploy with mid-analysis",
                plannedActions: [
                    { type: "command", intent: "s1" },
                    { type: "command", intent: "s2" },
                    { type: "command", intent: "s3" },
                    { type: "analysis", intent: "mid-point check" },
                    { type: "command", intent: "s4" },
                    { type: "command", intent: "s5" },
                    { type: "command", intent: "s6" },
                ],
            },
        });
        // Max consecutive is 3, which is within limit
        const result = (0, p6_bounded_execution_1.p6BoundedExecution)(input);
        strict_1.default.deepEqual(result, []);
    });
});
