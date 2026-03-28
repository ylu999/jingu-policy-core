"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p12_symptom_root_cause_1 = require("../../src/policies/senior/p12-symptom-root-cause");
function makeFrame(overrides = {}) {
    return {
        coreTension: "Reliability vs throughput in message queue",
        problemLayer: "execution",
        symptoms: ["messages are being dropped"],
        hypotheses: ["queue consumer is too slow"],
        verifiedFacts: ["consumer lag is increasing"],
        tradeoffs: ["throughput vs reliability"],
        proposedIntervention: "Scale consumers horizontally and add DLQ",
        ...overrides,
    };
}
function makeInput(frame) {
    return {
        task: { objective: "fix message queue" },
        proposal: { summary: "scale consumers", plannedActions: [] },
        reasoningFrame: frame,
    };
}
(0, node_test_1.describe)("P12 — Symptom vs Root Cause Separation", () => {
    (0, node_test_1.it)("returns no violations when no reasoningFrame provided", () => {
        const result = (0, p12_symptom_root_cause_1.p12SymptomRootCause)(makeInput());
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations for complete reasoning frame", () => {
        const result = (0, p12_symptom_root_cause_1.p12SymptomRootCause)(makeInput(makeFrame()));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when symptoms is empty", () => {
        const result = (0, p12_symptom_root_cause_1.p12SymptomRootCause)(makeInput(makeFrame({ symptoms: [] })));
        const symptomViolation = result.find((v) => v.message.includes("symptoms"));
        strict_1.default.ok(symptomViolation);
        strict_1.default.equal(symptomViolation.policyId, "P12");
        strict_1.default.equal(symptomViolation.severity, "reject");
    });
    (0, node_test_1.it)("rejects when hypotheses is empty", () => {
        const result = (0, p12_symptom_root_cause_1.p12SymptomRootCause)(makeInput(makeFrame({ hypotheses: [] })));
        const hypothesisViolation = result.find((v) => v.message.includes("hypotheses"));
        strict_1.default.ok(hypothesisViolation);
        strict_1.default.equal(hypothesisViolation.policyId, "P12");
        strict_1.default.equal(hypothesisViolation.severity, "reject");
    });
    (0, node_test_1.it)("warns when verifiedFacts is empty", () => {
        const result = (0, p12_symptom_root_cause_1.p12SymptomRootCause)(makeInput(makeFrame({ verifiedFacts: [] })));
        const factViolation = result.find((v) => v.message.includes("verifiedFacts"));
        strict_1.default.ok(factViolation);
        strict_1.default.equal(factViolation.policyId, "P12");
        strict_1.default.equal(factViolation.severity, "warning");
    });
    (0, node_test_1.it)("returns all three violations when all are empty", () => {
        const result = (0, p12_symptom_root_cause_1.p12SymptomRootCause)(makeInput(makeFrame({ symptoms: [], hypotheses: [], verifiedFacts: [] })));
        strict_1.default.equal(result.length, 3);
        const severities = result.map((v) => v.severity);
        strict_1.default.ok(severities.includes("reject"));
        strict_1.default.ok(severities.includes("warning"));
    });
});
