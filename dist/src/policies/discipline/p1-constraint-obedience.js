"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p1ConstraintObedience = void 0;
/**
 * P1 — Constraint Obedience
 * Detects actions that violate explicit task constraints.
 */
const p1ConstraintObedience = (input) => {
    const violations = [];
    const constraints = input.task.constraints?.explicitConstraints ?? [];
    if (constraints.length === 0)
        return violations;
    for (const action of input.proposal.plannedActions) {
        for (const constraint of constraints) {
            if (violatesConstraint(action, constraint)) {
                violations.push({
                    policyId: "P1",
                    severity: "reject",
                    message: `Action violates explicit constraint "${constraint}": intent="${action.intent}"${action.command ? `, command="${action.command}"` : ""}`,
                });
            }
        }
    }
    return violations;
};
exports.p1ConstraintObedience = p1ConstraintObedience;
function violatesConstraint(action, constraint) {
    const normalizedConstraint = constraint.toLowerCase().replace(/[_\s-]/g, "");
    // e.g. "terraform_only" → forbids direct cloud CLI usage
    if (normalizedConstraint === "terraformonly") {
        const cmd = (action.command ?? "").toLowerCase();
        const intent = action.intent.toLowerCase();
        // action uses aws/gcloud/az directly to create/delete resources
        if ((cmd.includes("aws") || cmd.includes("gcloud") || cmd.includes("az ")) &&
            (cmd.includes("create") || cmd.includes("delete") || cmd.includes("deploy") ||
                intent.includes("create") || intent.includes("delete") || intent.includes("deploy"))) {
            return true;
        }
    }
    // "no_write" → no write or command actions
    if (normalizedConstraint === "nowrite") {
        if (action.type === "write" || action.type === "command")
            return true;
    }
    // "read_only" → same as no_write
    if (normalizedConstraint === "readonly") {
        if (action.type === "write" || action.type === "command")
            return true;
    }
    // Generic: if action.command contains a forbidden keyword found in constraint
    const forbiddenKeyword = extractForbiddenKeyword(constraint);
    if (forbiddenKeyword) {
        const cmd = (action.command ?? "").toLowerCase();
        const intent = action.intent.toLowerCase();
        if (cmd.includes(forbiddenKeyword) || intent.includes(forbiddenKeyword)) {
            return true;
        }
    }
    return false;
}
function extractForbiddenKeyword(constraint) {
    // "no_<keyword>" patterns
    const noMatch = constraint.toLowerCase().match(/^no[_\s](.+)$/);
    if (noMatch)
        return noMatch[1].replace(/[_\s]/g, "");
    return null;
}
