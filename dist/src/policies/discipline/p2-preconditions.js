"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p2Preconditions = void 0;
/**
 * P2 — Preconditions Before Action
 * Blocks execution when required tools are missing.
 */
const p2Preconditions = (input) => {
    const violations = [];
    const failureSignals = input.evidence?.failureSignals ?? [];
    const requiredTools = input.task.constraints?.requiredTools ?? [];
    if (requiredTools.length === 0)
        return violations;
    const missingToolSignals = [
        "terraform_not_found",
        "missing_required_tool",
        "missing_dependency",
    ];
    const hasMissingTool = failureSignals.some((signal) => missingToolSignals.some((ms) => signal.toLowerCase().includes(ms.toLowerCase())));
    if (!hasMissingTool)
        return violations;
    // Determine which tools are likely missing based on signals
    for (const signal of failureSignals) {
        for (const tool of requiredTools) {
            if (signal.toLowerCase().includes(tool.toLowerCase()) ||
                signal.toLowerCase().includes("missing_required_tool") ||
                signal.toLowerCase().includes("missing_dependency")) {
                violations.push({
                    policyId: "P2",
                    severity: "block",
                    message: `Required tool "${tool}" appears to be missing (signal: "${signal}"). Verify preconditions before proceeding.`,
                });
                break;
            }
        }
        // Generic missing tool signal without specific tool name
        if (signal.toLowerCase().includes("terraform_not_found") &&
            requiredTools.includes("terraform")) {
            const alreadyAdded = violations.some((v) => v.message.includes("terraform"));
            if (!alreadyAdded) {
                violations.push({
                    policyId: "P2",
                    severity: "block",
                    message: `Required tool "terraform" not found. Install it before executing any planned actions.`,
                });
            }
        }
    }
    // Deduplicate by tool name
    const seen = new Set();
    return violations.filter((v) => {
        if (seen.has(v.message))
            return false;
        seen.add(v.message);
        return true;
    });
};
exports.p2Preconditions = p2Preconditions;
