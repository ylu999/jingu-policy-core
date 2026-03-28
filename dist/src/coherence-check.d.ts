import type { ReasoningFrame } from "./types.js";
export type CoherenceIssue = {
    chain: string;
    issue: string;
    severity: "reject" | "warning";
};
export type CoherenceResult = {
    coherent: true;
} | {
    coherent: false;
    issues: CoherenceIssue[];
};
/**
 * checkReasoningCoherence
 *
 * Validates that the reasoning chain is internally consistent.
 * Not just "fields exist" — but "the fields connect logically."
 *
 * Chain: coreTension → layer → symptoms → hypotheses → intervention → nextStep
 *
 * Design principle:
 * - Does NOT use keyword overlap (too easily gamed by injecting hypothesis words into symptoms)
 * - Checks for MECHANISM OBJECTS: hypothesis must name a plausible causal component
 * - Checks for INTERVENTION ALIGNMENT: fix must operate on the same mechanism the hypothesis names
 * - Checks for NON-RESTATEMENT: hypothesis must add explanatory content beyond symptoms
 */
export declare function checkReasoningCoherence(frame: ReasoningFrame): CoherenceResult;
export type CoherenceJudgeInput = {
    symptoms: string[];
    hypotheses: string[];
    proposedIntervention: string;
    rootCauseCandidate?: string;
};
export type CoherenceJudgeResult = {
    verdict: "coherent";
} | {
    verdict: "incoherent";
    reason: string;
    severity: "reject" | "warning";
};
export interface CoherenceJudge {
    /**
     * Semantically evaluates whether the reasoning chain is internally consistent.
     * Called only after deterministic local rules pass (or produce only warnings).
     */
    evaluate(input: CoherenceJudgeInput): Promise<CoherenceJudgeResult>;
}
