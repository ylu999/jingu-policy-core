"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p16ExternalizeContext = exports.p15FutureIntegrity = exports.p14MinimalIntervention = exports.p13Tradeoff = exports.p12SymptomRootCause = exports.p11LayerDiagnosis = exports.p10CoreTension = exports.p9HypothesisSearch = exports.p8ClaimHonesty = exports.p7Hygiene = exports.p6BoundedExecution = exports.p5RespectAuthority = exports.p4GlobalInvariants = exports.p3FailureClassification = exports.p2Preconditions = exports.p1ConstraintObedience = exports.disciplinePolicies = exports.seniorPolicies = exports.allPolicies = exports.P16 = exports.P15 = exports.P14 = exports.P13 = exports.P12 = exports.P11 = exports.P10 = exports.P9 = exports.P8 = exports.P7 = exports.P6 = exports.P5 = exports.P4 = exports.P3 = exports.P2 = exports.P1 = void 0;
// ─── P1: Constraint Bypass ───────────────────────────────────────────────────
// Agent proposes actions that violate explicit task constraints
const P1 = (input) => {
    const violations = [];
    const constraints = input.task.constraints;
    if (!constraints)
        return violations;
    const requiredTools = constraints.requiredTools ?? [];
    const explicitConstraints = constraints.explicitConstraints ?? [];
    const forbiddenPatterns = constraints.forbiddenPatterns ?? [];
    for (const action of input.proposal.plannedActions) {
        // Check if action uses a forbidden pattern
        for (const pattern of forbiddenPatterns) {
            const cmd = (action.command ?? "").toLowerCase();
            const intent = action.intent.toLowerCase();
            if (cmd.includes(pattern.toLowerCase()) || intent.includes(pattern.toLowerCase())) {
                violations.push({
                    policyId: "P1",
                    severity: "block",
                    message: `Action violates forbidden pattern "${pattern}": ${action.command ?? action.intent}`,
                });
            }
        }
        // Check if command-type action uses a tool NOT in requiredTools list
        // (requiredTools acts as an allow-list when explicitConstraints mentions them)
        if (action.type === "command" && requiredTools.length > 0) {
            const cmd = (action.command ?? "").toLowerCase();
            const usesRequiredTool = requiredTools.some(t => cmd.includes(t.toLowerCase()));
            if (!usesRequiredTool) {
                violations.push({
                    policyId: "P1",
                    severity: "block",
                    message: `Command "${action.command}" bypasses required-tool constraint. Allowed tools: ${requiredTools.join(", ")}`,
                });
            }
        }
        // Check explicit constraint labels (e.g. "terraform_only")
        for (const constraint of explicitConstraints) {
            if (constraint.endsWith("_only")) {
                const requiredTool = constraint.replace("_only", "");
                if (action.type === "command") {
                    const cmd = (action.command ?? "").toLowerCase();
                    if (!cmd.includes(requiredTool.toLowerCase())) {
                        // already covered by requiredTools check above, skip duplicate
                    }
                }
            }
        }
    }
    return violations;
};
exports.P1 = P1;
// ─── P2: Missing Precondition Check ──────────────────────────────────────────
// Agent proceeds without verifying required preconditions
const P2 = (input) => {
    const violations = [];
    const evidence = input.evidence;
    // If there are failure signals and no analysis actions before command actions,
    // the agent is skipping precondition checks
    if (evidence?.failureSignals && evidence.failureSignals.length > 0) {
        const hasAnalysis = input.proposal.plannedActions.some(a => a.type === "analysis" || a.type === "read");
        if (!hasAnalysis) {
            violations.push({
                policyId: "P2",
                severity: "reject",
                message: "Failure signals present but proposal lacks precondition analysis step",
            });
        }
    }
    return violations;
};
exports.P2 = P2;
// ─── P3: Blind Retry ─────────────────────────────────────────────────────────
// Agent retries the same failing action without diagnosis
const P3 = (input) => {
    const violations = [];
    const failureSignals = input.evidence?.failureSignals ?? [];
    // Detect repeated identical failure signals (e.g. ["same_failure", "same_failure"])
    const seen = new Map();
    for (const signal of failureSignals) {
        seen.set(signal, (seen.get(signal) ?? 0) + 1);
    }
    for (const [signal, count] of seen) {
        if (count >= 2) {
            violations.push({
                policyId: "P3",
                severity: "block",
                message: `Blind retry detected: failure signal "${signal}" repeated ${count} times without resolution`,
            });
            break;
        }
    }
    return violations;
};
exports.P3 = P3;
// ─── P4: Scope Escape ─────────────────────────────────────────────────────────
// Agent touches files/resources outside allowed mutation scope
const P4 = (input) => {
    const violations = [];
    const allowedScope = input.task.constraints?.allowedMutationScope;
    if (!allowedScope || allowedScope.length === 0)
        return violations;
    const changedFiles = input.evidence?.fileDiffSummary?.changedFiles ?? [];
    for (const file of changedFiles) {
        const inScope = allowedScope.some(scope => file.startsWith(scope));
        if (!inScope) {
            violations.push({
                policyId: "P4",
                severity: "reject",
                message: `File "${file}" is outside allowed mutation scope: ${allowedScope.join(", ")}`,
            });
        }
    }
    return violations;
};
exports.P4 = P4;
// ─── P5: Underdefined Plan ────────────────────────────────────────────────────
// Agent's proposal lacks sufficient detail to be executable
const P5 = (input) => {
    const violations = [];
    const actions = input.proposal.plannedActions;
    if (actions.length === 0) {
        violations.push({
            policyId: "P5",
            severity: "reject",
            message: "Proposal has no planned actions",
        });
        return violations;
    }
    for (const action of actions) {
        if (!action.intent || action.intent.trim().length === 0) {
            violations.push({
                policyId: "P5",
                severity: "warning",
                message: `Action of type "${action.type}" has no stated intent`,
            });
        }
    }
    return violations;
};
exports.P5 = P5;
// ─── P6: Unverified Mutation ──────────────────────────────────────────────────
// Agent applies mutations without verification evidence
const P6 = (input) => {
    const violations = [];
    const hasWriteAction = input.proposal.plannedActions.some(a => a.type === "write");
    if (!hasWriteAction)
        return violations;
    const hasEvidence = (input.evidence?.observations?.length ?? 0) > 0 ||
        (input.evidence?.commandResults?.length ?? 0) > 0;
    if (!hasEvidence) {
        violations.push({
            policyId: "P6",
            severity: "warning",
            message: "Write actions proposed without supporting evidence or prior observations",
        });
    }
    return violations;
};
exports.P6 = P6;
// ─── P7: Hygiene Violation ────────────────────────────────────────────────────
// Agent introduces repo hygiene issues (large files, generated artifacts, etc.)
const P7 = (input) => {
    const violations = [];
    const diff = input.evidence?.fileDiffSummary;
    if (!diff)
        return violations;
    const SIZE_LIMIT = 10000000; // 10MB
    if ((diff.sizeDelta ?? 0) > SIZE_LIMIT) {
        violations.push({
            policyId: "P7",
            severity: "block",
            message: `Repo size delta ${diff.sizeDelta} bytes exceeds hygiene limit (${SIZE_LIMIT} bytes). Likely committing generated/vendor artifacts.`,
        });
    }
    if ((diff.largeFilesAdded ?? 0) > 0) {
        violations.push({
            policyId: "P7",
            severity: "reject",
            message: `${diff.largeFilesAdded} large file(s) added to repository`,
        });
    }
    return violations;
};
exports.P7 = P7;
// ─── P8: Claim Inflation ──────────────────────────────────────────────────────
// Agent's claim exceeds what evidence supports
const P8 = (input) => {
    const violations = [];
    const claim = input.claim;
    if (!claim || claim.statements.length === 0)
        return violations;
    const evidence = input.evidence;
    const evidenceCount = (evidence?.observations?.length ?? 0) +
        (evidence?.commandResults?.length ?? 0);
    // More claims than evidence items = inflation
    if (claim.statements.length > Math.max(evidenceCount, 1) && evidenceCount === 0) {
        violations.push({
            policyId: "P8",
            severity: "reject",
            message: `Claim makes ${claim.statements.length} statement(s) but no supporting evidence provided`,
        });
    }
    return violations;
};
exports.P8 = P8;
// ─── P9: Search Without Reasoning ────────────────────────────────────────────
// Agent issues search/read actions without stating a hypothesis
const P9 = (input) => {
    const violations = [];
    for (const action of input.proposal.plannedActions) {
        if (action.type === "search" || action.type === "read") {
            if (!action.hypothesis) {
                violations.push({
                    policyId: "P9",
                    severity: "warning",
                    message: `${action.type} action "${action.query ?? action.intent}" has no hypothesis — searching without reasoning`,
                });
            }
        }
    }
    return violations;
};
exports.P9 = P9;
// ─── P10: Missing Core Tension (Senior) ──────────────────────────────────────
const P10 = (input) => {
    if (!input.reasoningFrame)
        return [];
    if (!input.reasoningFrame.coreTension || input.reasoningFrame.coreTension.trim().length < 10) {
        return [{
                policyId: "P10",
                severity: "reject",
                message: "Reasoning frame missing core tension — senior engineers articulate the fundamental constraint conflict",
            }];
    }
    return [];
};
exports.P10 = P10;
// ─── P11: Problem Layer Unidentified (Senior) ─────────────────────────────────
const P11 = (input) => {
    if (!input.reasoningFrame)
        return [];
    if (input.reasoningFrame.problemLayer === "unknown") {
        return [{
                policyId: "P11",
                severity: "reject",
                message: "Problem layer not identified — classify as requirements/architecture/environment/state/execution",
            }];
    }
    return [];
};
exports.P11 = P11;
// ─── P12: No Hypotheses (Senior) ─────────────────────────────────────────────
const P12 = (input) => {
    if (!input.reasoningFrame)
        return [];
    if (input.reasoningFrame.hypotheses.length === 0) {
        return [{
                policyId: "P12",
                severity: "reject",
                message: "No hypotheses in reasoning frame — senior engineers form and test hypotheses before acting",
            }];
    }
    return [];
};
exports.P12 = P12;
// ─── P13: No Tradeoffs Considered (Senior) ────────────────────────────────────
const P13 = (input) => {
    if (!input.reasoningFrame)
        return [];
    if (input.reasoningFrame.tradeoffs.length === 0) {
        return [{
                policyId: "P13",
                severity: "reject",
                message: "No tradeoffs considered — senior engineers explicitly weigh competing options",
            }];
    }
    return [];
};
exports.P13 = P13;
// ─── P14: No Intervention Stated (Senior) ────────────────────────────────────
const P14 = (input) => {
    if (!input.reasoningFrame)
        return [];
    if (!input.reasoningFrame.proposedIntervention || input.reasoningFrame.proposedIntervention.trim().length < 5) {
        return [{
                policyId: "P14",
                severity: "warning",
                message: "Proposed intervention not clearly stated in reasoning frame",
            }];
    }
    return [];
};
exports.P14 = P14;
// ─── P15: No Recurrence Prevention (Senior) ──────────────────────────────────
const P15 = (input) => {
    if (!input.reasoningFrame)
        return [];
    if (!input.reasoningFrame.recurrencePrevention) {
        return [{
                policyId: "P15",
                severity: "warning",
                message: "No recurrence prevention strategy — senior engineers close systemic gaps",
            }];
    }
    return [];
};
exports.P15 = P15;
// ─── P16: Externalize Working Context (Senior) ───────────────────────────────
// Agent acts without externalizing working context to durable artifacts
const P16 = (input) => {
    const violations = [];
    const hasWriteOrCommand = input.proposal.plannedActions.some(a => a.type === "write" || a.type === "command");
    const hasContextRef = input.evidence?.observations?.some(o => o.toLowerCase().includes(".jingu/context") ||
        o.toLowerCase().includes("active-task") ||
        o.toLowerCase().includes("working context")) ||
        input.evidence?.commandResults?.some(r => r.toLowerCase().includes(".jingu/context") ||
            r.toLowerCase().includes("active-task"));
    if (hasWriteOrCommand && !hasContextRef && !input.reasoningFrame?.coreTension) {
        violations.push({
            policyId: "P16",
            severity: "reject",
            message: "Context not externalized before action. Write working context (facts, hypotheses, plan, next step) to .jingu/context/ before proposing mutations.",
        });
    }
    const sameFailures = (input.evidence?.failureSignals || []).filter(f => f === "same_failure").length;
    if (sameFailures >= 2) {
        const contextUpdated = input.evidence?.observations?.some(o => o.toLowerCase().includes("updated context") ||
            o.toLowerCase().includes("context updated") ||
            o.toLowerCase().includes("active-task updated"));
        if (!contextUpdated) {
            violations.push({
                policyId: "P16",
                severity: "reject",
                message: "Retry detected without updating working context. Before retrying, update .jingu/context/active-task with new failure facts and revised hypotheses.",
            });
        }
    }
    const hasClaim = (input.claim?.statements || []).some(s => {
        const lower = s.toLowerCase();
        return (lower.includes("completed") ||
            lower.includes("resolved") ||
            lower.includes("done") ||
            lower.includes("fixed") ||
            lower.includes("deployed"));
    });
    const hasEvidenceSummary = (input.evidence?.commandResults || []).length > 0 ||
        input.evidence?.observations?.some(o => o.toLowerCase().includes("evidence") ||
            o.toLowerCase().includes("verified") ||
            o.toLowerCase().includes("confirmed"));
    if (hasClaim && !hasEvidenceSummary) {
        violations.push({
            policyId: "P16",
            severity: "reject",
            message: "Completion claim made without durable evidence summary. Write final working state and evidence refs to .jingu/context/ before claiming completion.",
        });
    }
    const frame = input.reasoningFrame;
    if (frame) {
        const isHollow = frame.coreTension.length < 10 &&
            frame.symptoms.length === 0 &&
            frame.hypotheses.length === 0 &&
            frame.verifiedFacts.length === 0;
        if (isHollow) {
            violations.push({
                policyId: "P16",
                severity: "warning",
                message: "ReasoningFrame exists but is empty — working context not externalized. Fill in known facts, hypotheses, and current plan.",
            });
        }
    }
    return violations;
};
exports.P16 = P16;
// ─── Policy Collections ───────────────────────────────────────────────────────
exports.allPolicies = [exports.P1, exports.P2, exports.P3, exports.P4, exports.P5, exports.P6, exports.P7, exports.P8, exports.P9];
exports.seniorPolicies = [exports.P10, exports.P11, exports.P12, exports.P13, exports.P14, exports.P15, exports.P16];
exports.disciplinePolicies = [...exports.allPolicies, ...exports.seniorPolicies];
// ─── Named aliases (descriptive names) ───────────────────────────────────────
exports.p1ConstraintObedience = exports.P1;
exports.p2Preconditions = exports.P2;
exports.p3FailureClassification = exports.P3;
exports.p4GlobalInvariants = exports.P4;
exports.p5RespectAuthority = exports.P5;
exports.p6BoundedExecution = exports.P6;
exports.p7Hygiene = exports.P7;
exports.p8ClaimHonesty = exports.P8;
exports.p9HypothesisSearch = exports.P9;
exports.p10CoreTension = exports.P10;
exports.p11LayerDiagnosis = exports.P11;
exports.p12SymptomRootCause = exports.P12;
exports.p13Tradeoff = exports.P13;
exports.p14MinimalIntervention = exports.P14;
exports.p15FutureIntegrity = exports.P15;
exports.p16ExternalizeContext = exports.P16;
