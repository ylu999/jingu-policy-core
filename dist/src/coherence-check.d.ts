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
 */
export declare function checkReasoningCoherence(frame: ReasoningFrame): CoherenceResult;
