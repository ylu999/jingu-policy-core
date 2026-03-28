"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p13Tradeoff = void 0;
/**
 * P13 — Tradeoff Awareness
 * Rejects reasoning frames that acknowledge no tradeoffs.
 */
const p13Tradeoff = (input) => {
    const violations = [];
    const frame = input.reasoningFrame;
    if (!frame)
        return violations;
    if (!frame.tradeoffs || frame.tradeoffs.length === 0) {
        violations.push({
            policyId: "P13",
            severity: "reject",
            message: `ReasoningFrame.tradeoffs is empty. Every engineering decision involves tradeoffs — document at least one before proceeding.`,
        });
    }
    return violations;
};
exports.p13Tradeoff = p13Tradeoff;
