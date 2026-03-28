"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p10_core_tension_1 = require("../../src/policies/senior/p10-core-tension");
function makeFrame(overrides = {}) {
    return {
        coreTension: "Speed vs reliability in deployment pipeline",
        problemLayer: "execution",
        symptoms: ["deployment fails intermittently"],
        hypotheses: ["race condition in deploy script"],
        verifiedFacts: ["CI logs show timeout errors"],
        tradeoffs: ["faster deploy vs stability"],
        proposedIntervention: "Add retry logic with exponential backoff",
        ...overrides,
    };
}
function makeInput(frame) {
    return {
        task: { objective: "fix deployment" },
        proposal: { summary: "fix deploy", plannedActions: [] },
        reasoningFrame: frame,
    };
}
(0, node_test_1.describe)("P10 — Core Tension First", () => {
    (0, node_test_1.it)("returns no violations when no reasoningFrame provided", () => {
        const result = (0, p10_core_tension_1.p10CoreTension)(makeInput());
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations when coreTension is sufficiently long", () => {
        const result = (0, p10_core_tension_1.p10CoreTension)(makeInput(makeFrame()));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when coreTension is too short", () => {
        const result = (0, p10_core_tension_1.p10CoreTension)(makeInput(makeFrame({ coreTension: "short" })));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P10");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /coreTension/);
    });
    (0, node_test_1.it)("rejects when coreTension is empty string", () => {
        const result = (0, p10_core_tension_1.p10CoreTension)(makeInput(makeFrame({ coreTension: "" })));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P10");
        strict_1.default.equal(result[0].severity, "reject");
    });
    (0, node_test_1.it)("rejects when coreTension is exactly 9 characters (below minimum of 10)", () => {
        const result = (0, p10_core_tension_1.p10CoreTension)(makeInput(makeFrame({ coreTension: "123456789" })));
        strict_1.default.equal(result.length, 1);
    });
    (0, node_test_1.it)("returns no violations when coreTension is exactly 10 characters", () => {
        const result = (0, p10_core_tension_1.p10CoreTension)(makeInput(makeFrame({ coreTension: "1234567890" })));
        strict_1.default.deepEqual(result, []);
    });
});
