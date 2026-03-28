"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p9HypothesisSearch = void 0;
/**
 * P9 — Hypothesis-Driven Search
 * Rejects search actions that lack a stated hypothesis.
 */
const p9HypothesisSearch = (input) => {
    const violations = [];
    for (const action of input.proposal.plannedActions) {
        if (action.type === "search") {
            const hasHypothesis = action.hypothesis !== undefined && action.hypothesis.trim().length > 0;
            if (!hasHypothesis) {
                violations.push({
                    policyId: "P9",
                    severity: "reject",
                    message: `Search action "${action.intent}" has no hypothesis. Every search must be driven by a specific hypothesis to avoid aimless exploration.`,
                });
            }
        }
    }
    return violations;
};
exports.p9HypothesisSearch = p9HypothesisSearch;
