"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p11_layer_diagnosis_1 = require("../../src/policies/senior/p11-layer-diagnosis");
function makeFrame(problemLayer) {
    return {
        coreTension: "Correctness vs performance in data pipeline",
        problemLayer,
        symptoms: ["slow query"],
        hypotheses: ["missing index"],
        verifiedFacts: ["query plan shows full scan"],
        tradeoffs: ["index write overhead vs read speed"],
        proposedIntervention: "Add composite index on (user_id, created_at)",
    };
}
function makeInput(frame) {
    return {
        task: { objective: "optimize query" },
        proposal: { summary: "add index", plannedActions: [] },
        reasoningFrame: frame,
    };
}
(0, node_test_1.describe)("P11 — Correct Layer Diagnosis", () => {
    (0, node_test_1.it)("returns no violations when no reasoningFrame provided", () => {
        const result = (0, p11_layer_diagnosis_1.p11LayerDiagnosis)(makeInput());
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when problemLayer is unknown", () => {
        const result = (0, p11_layer_diagnosis_1.p11LayerDiagnosis)(makeInput(makeFrame("unknown")));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P11");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /unknown/);
    });
    (0, node_test_1.it)("returns no violations for execution layer", () => {
        const result = (0, p11_layer_diagnosis_1.p11LayerDiagnosis)(makeInput(makeFrame("execution")));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations for architecture layer", () => {
        const result = (0, p11_layer_diagnosis_1.p11LayerDiagnosis)(makeInput(makeFrame("architecture")));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations for requirements layer", () => {
        const result = (0, p11_layer_diagnosis_1.p11LayerDiagnosis)(makeInput(makeFrame("requirements")));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations for environment layer", () => {
        const result = (0, p11_layer_diagnosis_1.p11LayerDiagnosis)(makeInput(makeFrame("environment")));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations for state layer", () => {
        const result = (0, p11_layer_diagnosis_1.p11LayerDiagnosis)(makeInput(makeFrame("state")));
        strict_1.default.deepEqual(result, []);
    });
});
