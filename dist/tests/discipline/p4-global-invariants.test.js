"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p4_global_invariants_1 = require("../../src/policies/discipline/p4-global-invariants");
function makeInput(overrides = {}) {
    return {
        task: { objective: "fix bug" },
        proposal: { summary: "fix the bug", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P4 — Global Invariants Over Local Progress", () => {
    (0, node_test_1.it)("returns no violations for clean proposal without quick-fix language", () => {
        const input = makeInput({
            proposal: {
                summary: "refactor authentication module to use proper token validation",
                plannedActions: [
                    { type: "write", intent: "update auth logic" },
                ],
            },
        });
        const result = (0, p4_global_invariants_1.p4GlobalInvariants)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects quick fix without follow-up plan", () => {
        const input = makeInput({
            proposal: {
                summary: "quick fix for the auth bug",
                plannedActions: [
                    { type: "write", intent: "patch auth check" },
                ],
            },
        });
        const result = (0, p4_global_invariants_1.p4GlobalInvariants)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P4");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /quick.fix/i);
    });
    (0, node_test_1.it)("returns no violations when quick fix includes follow-up documentation", () => {
        const input = makeInput({
            proposal: {
                summary: "temporary workaround for auth bug",
                reasoning: "This is a short-term fix; a permanent fix is tracked in ticket JIRA-123 and will be addressed next sprint.",
                plannedActions: [
                    { type: "write", intent: "apply workaround" },
                ],
            },
        });
        const result = (0, p4_global_invariants_1.p4GlobalInvariants)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects workaround in action intent without follow-up", () => {
        const input = makeInput({
            proposal: {
                summary: "deploy new version",
                plannedActions: [
                    { type: "command", intent: "apply workaround in production config" },
                ],
            },
        });
        const result = (0, p4_global_invariants_1.p4GlobalInvariants)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P4");
    });
    (0, node_test_1.it)("returns no violations for temporary fix with follow-up in reasoning", () => {
        const input = makeInput({
            proposal: {
                summary: "temporary patch",
                reasoning: "will be fixed properly in the long-term refactor scheduled for Q2",
                plannedActions: [],
            },
        });
        const result = (0, p4_global_invariants_1.p4GlobalInvariants)(input);
        strict_1.default.deepEqual(result, []);
    });
});
