"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p6BoundedExecution = void 0;
const MAX_MUTATING_ACTIONS_BEFORE_ANALYSIS = 5;
/**
 * P6 — Bounded & Disciplined Execution
 * Rejects proposals that have too many consecutive write/command actions
 * without analysis or read actions interspersed.
 */
const p6BoundedExecution = (input) => {
    const violations = [];
    const actions = input.proposal.plannedActions;
    let consecutiveMutating = 0;
    let maxConsecutive = 0;
    for (const action of actions) {
        if (action.type === "write" || action.type === "command") {
            consecutiveMutating++;
            if (consecutiveMutating > maxConsecutive) {
                maxConsecutive = consecutiveMutating;
            }
        }
        else {
            // read or analysis resets the counter
            consecutiveMutating = 0;
        }
    }
    if (maxConsecutive > MAX_MUTATING_ACTIONS_BEFORE_ANALYSIS) {
        violations.push({
            policyId: "P6",
            severity: "reject",
            message: `Proposal contains ${maxConsecutive} consecutive write/command actions without interspersed analysis or read steps (limit: ${MAX_MUTATING_ACTIONS_BEFORE_ANALYSIS}). Break up execution with observation checkpoints.`,
        });
    }
    return violations;
};
exports.p6BoundedExecution = p6BoundedExecution;
