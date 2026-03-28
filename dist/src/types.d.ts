export type Severity = "warning" | "reject" | "block";
export type Violation = {
    policyId: string;
    severity: Severity;
    message: string;
};
export type ProblemLayer = "requirements" | "architecture" | "environment" | "state" | "execution" | "unknown";
export type Action = {
    type: "read" | "write" | "command" | "analysis" | "search";
    command?: string;
    query?: string;
    intent: string;
    hypothesis?: string;
};
export type Proposal = {
    summary: string;
    plannedActions: Action[];
    reasoning?: string;
};
export type Evidence = {
    observations?: string[];
    failureSignals?: string[];
    commandResults?: string[];
    fileDiffSummary?: {
        changedFiles: string[];
        sizeDelta?: number;
        largeFilesAdded?: number;
    };
};
export type Claim = {
    statements: string[];
    confidence?: "low" | "medium" | "high";
};
export type ReasoningFrame = {
    coreTension: string;
    problemLayer: ProblemLayer;
    symptoms: string[];
    hypotheses: string[];
    verifiedFacts: string[];
    rootCauseCandidate?: string;
    tradeoffs: string[];
    proposedIntervention: string;
    recurrencePrevention?: string;
};
export type TaskContract = {
    objective: string;
    constraints?: {
        explicitConstraints?: string[];
        requiredTools?: string[];
        allowedMutationScope?: string[];
        forbiddenPatterns?: string[];
    };
    successCriteria?: string[];
};
export type Input = {
    task: TaskContract;
    proposal: Proposal;
    evidence?: Evidence;
    claim?: Claim;
    reasoningFrame?: ReasoningFrame;
};
export type Policy = (input: Input) => Violation[];
