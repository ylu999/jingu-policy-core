"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateV4Sync = void 0;
exports.evaluateV4 = evaluateV4;
const reasoning_gate_1 = require("./reasoning-gate");
const policies_1 = require("./policies");
function scoreFromViolations(violations, policyCount) {
    if (policyCount === 0)
        return 100;
    const penalty = violations.reduce((acc, v) => {
        if (v.severity === "block")
            return acc + 3;
        if (v.severity === "reject")
            return acc + 2;
        return acc + 1;
    }, 0);
    const maxPenalty = policyCount * 3;
    return Math.max(0, Math.round(100 - (penalty / maxPenalty) * 100));
}
function decideFromViolations(violations, reasoningViolations) {
    const all = [...violations, ...reasoningViolations];
    if (all.some(v => v.severity === "block"))
        return "block";
    if (all.some(v => v.severity === "reject"))
        return "reject";
    return "accept";
}
/**
 * evaluateV4
 *
 * Full pipeline:
 * 1. enforceReasoningFrame — must pass before ANY regime evaluation
 * 2. Regime evaluation — P1-P16 discipline + senior reasoning
 *
 * "No action without reasoning."
 */
function evaluateV4(input) {
    // Stage 1: Reasoning Gate
    const reasoningCheck = (0, reasoning_gate_1.enforceReasoningFrame)(input);
    if (reasoningCheck.decision !== "accept") {
        return {
            stage: "reasoning",
            decision: "reject",
            reason: reasoningCheck.reason,
            requiredFix: reasoningCheck.requiredFix,
        };
    }
    // Stage 2: Regime evaluation (P1-P9 discipline + P10-P16 senior)
    const violations = [];
    for (const policy of policies_1.allPolicies) {
        violations.push(...policy(input));
    }
    const reasoningViolations = [];
    for (const policy of policies_1.seniorPolicies) {
        reasoningViolations.push(...policy(input));
    }
    const score = scoreFromViolations(violations, policies_1.allPolicies.length);
    const decision = decideFromViolations(violations, reasoningViolations);
    const total = violations.length + reasoningViolations.length;
    let summary;
    if (decision === "block") {
        const blocked = [...violations, ...reasoningViolations].filter(v => v.severity === "block");
        summary = `BLOCKED — ${blocked.length} critical violation(s). Score: ${score}/100.`;
    }
    else if (decision === "reject") {
        summary = `REJECTED — ${total} violation(s). Score: ${score}/100.`;
    }
    else if (total > 0) {
        summary = `ACCEPTED with warnings — ${total} issue(s). Score: ${score}/100.`;
    }
    else {
        summary = `ACCEPTED — No violations. Score: ${score}/100.`;
    }
    return {
        stage: "regime",
        decision,
        score,
        violations,
        reasoningViolations,
        summary,
    };
}
// Alias for compatibility
exports.evaluateV4Sync = evaluateV4;
