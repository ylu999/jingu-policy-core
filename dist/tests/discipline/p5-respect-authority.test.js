"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p5_respect_authority_1 = require("../../src/policies/discipline/p5-respect-authority");
function makeInput(overrides = {}) {
    return {
        task: { objective: "update feature" },
        proposal: { summary: "update feature flag", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P5 — Respect Authority & Boundaries", () => {
    (0, node_test_1.it)("returns no violations for normal action", () => {
        const input = makeInput({
            proposal: {
                summary: "add feature",
                plannedActions: [
                    { type: "write", intent: "add new endpoint to API" },
                ],
            },
        });
        const result = (0, p5_respect_authority_1.p5RespectAuthority)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects action with bypass intent", () => {
        const input = makeInput({
            proposal: {
                summary: "deploy",
                plannedActions: [
                    { type: "command", intent: "bypass authentication to speed up deployment" },
                ],
            },
        });
        const result = (0, p5_respect_authority_1.p5RespectAuthority)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P5");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /bypass/);
    });
    (0, node_test_1.it)("rejects action that attempts to replace authority", () => {
        const input = makeInput({
            proposal: {
                summary: "overhaul auth",
                plannedActions: [
                    { type: "write", intent: "replace authority module with custom implementation" },
                ],
            },
        });
        const result = (0, p5_respect_authority_1.p5RespectAuthority)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P5");
        strict_1.default.equal(result[0].severity, "reject");
    });
    (0, node_test_1.it)("rejects action with change architecture intent", () => {
        const input = makeInput({
            proposal: {
                summary: "refactor",
                plannedActions: [
                    { type: "write", intent: "change architecture of the authorization service" },
                ],
            },
        });
        const result = (0, p5_respect_authority_1.p5RespectAuthority)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P5");
    });
    (0, node_test_1.it)("returns multiple violations for multiple offending actions", () => {
        const input = makeInput({
            proposal: {
                summary: "overhaul",
                plannedActions: [
                    { type: "command", intent: "bypass approval gate" },
                    { type: "write", intent: "circumvent the rate limiter" },
                ],
            },
        });
        const result = (0, p5_respect_authority_1.p5RespectAuthority)(input);
        strict_1.default.equal(result.length, 2);
    });
});
