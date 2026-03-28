"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p12SymptomRootCause = void 0;
/**
 * P12 — Symptom vs Root Cause Separation
 * Rejects/warns when symptoms, hypotheses, or verified facts are empty.
 */
const p12SymptomRootCause = (input) => {
    const violations = [];
    const frame = input.reasoningFrame;
    if (!frame)
        return violations;
    if (!frame.symptoms || frame.symptoms.length === 0) {
        violations.push({
            policyId: "P12",
            severity: "reject",
            message: `ReasoningFrame.symptoms is empty. List observed symptoms before diagnosing root cause.`,
        });
    }
    if (!frame.hypotheses || frame.hypotheses.length === 0) {
        violations.push({
            policyId: "P12",
            severity: "reject",
            message: `ReasoningFrame.hypotheses is empty. Formulate at least one root cause hypothesis before proposing a fix.`,
        });
    }
    if (!frame.verifiedFacts || frame.verifiedFacts.length === 0) {
        violations.push({
            policyId: "P12",
            severity: "warning",
            message: `ReasoningFrame.verifiedFacts is empty. Support your diagnosis with verified facts to increase confidence.`,
        });
    }
    return violations;
};
exports.p12SymptomRootCause = p12SymptomRootCause;
