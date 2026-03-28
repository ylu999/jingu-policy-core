"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p2_preconditions_1 = require("../../src/policies/discipline/p2-preconditions");
function makeInput(overrides = {}) {
    return {
        task: { objective: "deploy infrastructure" },
        proposal: { summary: "deploy", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P2 — Preconditions Before Action", () => {
    (0, node_test_1.it)("returns no violations when no required tools defined", () => {
        const input = makeInput({
            evidence: { failureSignals: ["terraform_not_found"] },
        });
        const result = (0, p2_preconditions_1.p2Preconditions)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("blocks when terraform_not_found signal and terraform is required", () => {
        const input = makeInput({
            task: {
                objective: "deploy",
                constraints: { requiredTools: ["terraform"] },
            },
            evidence: { failureSignals: ["terraform_not_found"] },
        });
        const result = (0, p2_preconditions_1.p2Preconditions)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P2");
        strict_1.default.equal(result[0].severity, "block");
        strict_1.default.match(result[0].message, /terraform/);
    });
    (0, node_test_1.it)("blocks when missing_required_tool signal present", () => {
        const input = makeInput({
            task: {
                objective: "deploy",
                constraints: { requiredTools: ["kubectl"] },
            },
            evidence: { failureSignals: ["missing_required_tool: kubectl"] },
        });
        const result = (0, p2_preconditions_1.p2Preconditions)(input);
        strict_1.default.equal(result.length >= 1, true);
        strict_1.default.equal(result[0].policyId, "P2");
        strict_1.default.equal(result[0].severity, "block");
    });
    (0, node_test_1.it)("returns no violations when required tools are present (no failure signals)", () => {
        const input = makeInput({
            task: {
                objective: "deploy",
                constraints: { requiredTools: ["terraform"] },
            },
            evidence: { failureSignals: [] },
        });
        const result = (0, p2_preconditions_1.p2Preconditions)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("blocks when missing_dependency signal present", () => {
        const input = makeInput({
            task: {
                objective: "build",
                constraints: { requiredTools: ["node"] },
            },
            evidence: { failureSignals: ["missing_dependency: node"] },
        });
        const result = (0, p2_preconditions_1.p2Preconditions)(input);
        strict_1.default.equal(result.length >= 1, true);
        strict_1.default.equal(result[0].policyId, "P2");
        strict_1.default.equal(result[0].severity, "block");
    });
});
