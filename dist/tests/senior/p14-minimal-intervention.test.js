"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p14_minimal_intervention_1 = require("../../src/policies/senior/p14-minimal-intervention");
function makeFrame(overrides = {}) {
    return {
        coreTension: "Speed vs correctness in data migration",
        problemLayer: "execution",
        symptoms: ["migration script fails on large tables"],
        hypotheses: ["batch size too large causing OOM"],
        verifiedFacts: ["OOM error in migration logs"],
        tradeoffs: ["migration speed vs memory usage"],
        proposedIntervention: "Reduce batch size from 10000 to 1000 rows per transaction",
        ...overrides,
    };
}
function makeInput(frame) {
    return {
        task: { objective: "fix migration" },
        proposal: { summary: "reduce batch size", plannedActions: [] },
        reasoningFrame: frame,
    };
}
(0, node_test_1.describe)("P14 — Minimal Sufficient Intervention", () => {
    (0, node_test_1.it)("returns no violations when no reasoningFrame provided", () => {
        const result = (0, p14_minimal_intervention_1.p14MinimalIntervention)(makeInput());
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations for well-described intervention", () => {
        const result = (0, p14_minimal_intervention_1.p14MinimalIntervention)(makeInput(makeFrame()));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when proposedIntervention is too short", () => {
        const result = (0, p14_minimal_intervention_1.p14MinimalIntervention)(makeInput(makeFrame({ proposedIntervention: "fix it" })));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P14");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /proposedIntervention/);
    });
    (0, node_test_1.it)("rejects when proposedIntervention is empty string", () => {
        const result = (0, p14_minimal_intervention_1.p14MinimalIntervention)(makeInput(makeFrame({ proposedIntervention: "" })));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P14");
    });
    (0, node_test_1.it)("rejects when proposedIntervention is exactly 9 characters", () => {
        const result = (0, p14_minimal_intervention_1.p14MinimalIntervention)(makeInput(makeFrame({ proposedIntervention: "123456789" })));
        strict_1.default.equal(result.length, 1);
    });
    (0, node_test_1.it)("returns no violations when proposedIntervention is exactly 10 characters", () => {
        const result = (0, p14_minimal_intervention_1.p14MinimalIntervention)(makeInput(makeFrame({ proposedIntervention: "1234567890" })));
        strict_1.default.deepEqual(result, []);
    });
});
