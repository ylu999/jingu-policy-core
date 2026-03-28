"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p15FutureIntegrity = void 0;
/**
 * P15 — Future-State Integrity
 * Warns when no recurrence prevention strategy is documented.
 */
const p15FutureIntegrity = (input) => {
    const violations = [];
    const frame = input.reasoningFrame;
    if (!frame)
        return violations;
    if (!frame.recurrencePrevention ||
        frame.recurrencePrevention.trim().length === 0) {
        violations.push({
            policyId: "P15",
            severity: "warning",
            message: `ReasoningFrame.recurrencePrevention is not set. Document how this problem will be prevented from recurring.`,
        });
    }
    return violations;
};
exports.p15FutureIntegrity = p15FutureIntegrity;
