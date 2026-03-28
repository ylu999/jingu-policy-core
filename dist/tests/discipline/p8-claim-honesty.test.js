"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p8_claim_honesty_1 = require("../../src/policies/discipline/p8-claim-honesty");
function makeInput(overrides = {}) {
    return {
        task: { objective: "deploy" },
        proposal: { summary: "deploy", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P8 — Claim Honesty", () => {
    (0, node_test_1.it)("returns no violations when no claim", () => {
        const input = makeInput();
        const result = (0, p8_claim_honesty_1.p8ClaimHonesty)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations when claim has no strong assertions", () => {
        const input = makeInput({
            claim: {
                statements: ["Deployment is in progress", "Resources are being provisioned"],
            },
        });
        const result = (0, p8_claim_honesty_1.p8ClaimHonesty)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects strong claim without command results", () => {
        const input = makeInput({
            claim: {
                statements: ["Deployment completed successfully"],
            },
            evidence: { commandResults: [] },
        });
        const result = (0, p8_claim_honesty_1.p8ClaimHonesty)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P8");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /completed/);
    });
    (0, node_test_1.it)("returns no violations when strong claim is backed by evidence", () => {
        const input = makeInput({
            claim: {
                statements: ["Deployment completed successfully"],
            },
            evidence: {
                commandResults: ["Apply complete! Resources: 3 added, 0 changed, 0 destroyed."],
            },
        });
        const result = (0, p8_claim_honesty_1.p8ClaimHonesty)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects done claim with no evidence at all", () => {
        const input = makeInput({
            claim: {
                statements: ["All tests pass and the feature is done"],
            },
        });
        const result = (0, p8_claim_honesty_1.p8ClaimHonesty)(input);
        strict_1.default.equal(result.length >= 1, true);
        strict_1.default.equal(result[0].policyId, "P8");
        strict_1.default.equal(result[0].severity, "reject");
    });
    (0, node_test_1.it)("rejects multiple strong claim statements without evidence", () => {
        const input = makeInput({
            claim: {
                statements: ["Infrastructure successfully deployed", "All services done"],
            },
            evidence: { commandResults: undefined },
        });
        const result = (0, p8_claim_honesty_1.p8ClaimHonesty)(input);
        strict_1.default.equal(result.length, 2);
    });
});
