"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p13_tradeoff_1 = require("../../src/policies/senior/p13-tradeoff");
function makeFrame(overrides = {}) {
    return {
        coreTension: "Cost vs availability for redundant storage",
        problemLayer: "architecture",
        symptoms: ["storage failures causing downtime"],
        hypotheses: ["single point of failure in storage"],
        verifiedFacts: ["no replication configured"],
        tradeoffs: ["higher cost for redundancy vs availability risk"],
        proposedIntervention: "Enable cross-region replication on critical buckets",
        ...overrides,
    };
}
function makeInput(frame) {
    return {
        task: { objective: "improve storage reliability" },
        proposal: { summary: "enable replication", plannedActions: [] },
        reasoningFrame: frame,
    };
}
(0, node_test_1.describe)("P13 — Tradeoff Awareness", () => {
    (0, node_test_1.it)("returns no violations when no reasoningFrame provided", () => {
        const result = (0, p13_tradeoff_1.p13Tradeoff)(makeInput());
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations when tradeoffs are documented", () => {
        const result = (0, p13_tradeoff_1.p13Tradeoff)(makeInput(makeFrame()));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects when tradeoffs is empty array", () => {
        const result = (0, p13_tradeoff_1.p13Tradeoff)(makeInput(makeFrame({ tradeoffs: [] })));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P13");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /tradeoffs/);
    });
    (0, node_test_1.it)("returns no violations with multiple tradeoffs", () => {
        const result = (0, p13_tradeoff_1.p13Tradeoff)(makeInput(makeFrame({
            tradeoffs: [
                "higher cost vs availability",
                "complexity vs resilience",
                "latency vs consistency",
            ],
        })));
        strict_1.default.deepEqual(result, []);
    });
});
