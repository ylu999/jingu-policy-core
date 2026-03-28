"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p9_hypothesis_search_1 = require("../../src/policies/discipline/p9-hypothesis-search");
function makeInput(overrides = {}) {
    return {
        task: { objective: "debug issue" },
        proposal: { summary: "investigate", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P9 — Hypothesis-Driven Search", () => {
    (0, node_test_1.it)("returns no violations when no search actions", () => {
        const input = makeInput({
            proposal: {
                summary: "fix bug",
                plannedActions: [
                    { type: "read", intent: "read logs" },
                    { type: "analysis", intent: "analyze logs" },
                ],
            },
        });
        const result = (0, p9_hypothesis_search_1.p9HypothesisSearch)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects search action without hypothesis", () => {
        const input = makeInput({
            proposal: {
                summary: "search for root cause",
                plannedActions: [
                    { type: "search", query: "error logs", intent: "find errors in logs" },
                ],
            },
        });
        const result = (0, p9_hypothesis_search_1.p9HypothesisSearch)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P9");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /hypothesis/);
    });
    (0, node_test_1.it)("returns no violations when search action has hypothesis", () => {
        const input = makeInput({
            proposal: {
                summary: "search with hypothesis",
                plannedActions: [
                    {
                        type: "search",
                        query: "OOM error",
                        intent: "find memory-related errors",
                        hypothesis: "The service is crashing due to memory exhaustion under high load",
                    },
                ],
            },
        });
        const result = (0, p9_hypothesis_search_1.p9HypothesisSearch)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects search with empty string hypothesis", () => {
        const input = makeInput({
            proposal: {
                summary: "search",
                plannedActions: [
                    { type: "search", intent: "look for issues", hypothesis: "   " },
                ],
            },
        });
        const result = (0, p9_hypothesis_search_1.p9HypothesisSearch)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P9");
    });
    (0, node_test_1.it)("returns violations only for search actions, not other types", () => {
        const input = makeInput({
            proposal: {
                summary: "mixed actions",
                plannedActions: [
                    { type: "read", intent: "read file" }, // ok - not search
                    { type: "search", intent: "find pattern" }, // no hypothesis - violation
                    { type: "search", intent: "locate config", hypothesis: "Config is in /etc" }, // ok
                ],
            },
        });
        const result = (0, p9_hypothesis_search_1.p9HypothesisSearch)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.match(result[0].message, /find pattern/);
    });
});
