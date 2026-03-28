"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p3FailureClassification = void 0;
/**
 * P3 — Failure Classification Before Retry
 * Rejects proposals that retry without classifying the failure first.
 */
const p3FailureClassification = (input) => {
    const violations = [];
    const failureSignals = input.evidence?.failureSignals ?? [];
    // Count "same_failure" signals
    const sameFailureCount = failureSignals.filter((s) => s.toLowerCase().includes("same_failure")).length;
    if (sameFailureCount <= 1)
        return violations;
    // Check if proposal introduces new hypotheses
    const hasNewHypothesis = input.proposal.plannedActions.some((a) => a.hypothesis && a.hypothesis.trim().length > 0);
    if (!hasNewHypothesis) {
        violations.push({
            policyId: "P3",
            severity: "reject",
            message: `Detected ${sameFailureCount} repeated "same_failure" signals but no new hypothesis in proposal. Classify the failure before retrying.`,
        });
    }
    return violations;
};
exports.p3FailureClassification = p3FailureClassification;
