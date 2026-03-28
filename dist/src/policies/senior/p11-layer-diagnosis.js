"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p11LayerDiagnosis = void 0;
/**
 * P11 — Correct Layer Diagnosis
 * Rejects reasoning frames where the problem layer is "unknown".
 */
const p11LayerDiagnosis = (input) => {
    const violations = [];
    const frame = input.reasoningFrame;
    if (!frame)
        return violations;
    if (frame.problemLayer === "unknown") {
        violations.push({
            policyId: "P11",
            severity: "reject",
            message: `ReasoningFrame.problemLayer is "unknown". Diagnose whether the problem is in requirements, architecture, environment, state, or execution before proposing a fix.`,
        });
    }
    return violations;
};
exports.p11LayerDiagnosis = p11LayerDiagnosis;
