import type { ReasoningFrame } from "./types";
export type ReasoningGateResult = {
    decision: "accept";
} | {
    decision: "reject";
    reason: string;
    requiredFix: string[];
};
/**
 * enforceReasoningFrame
 *
 * Gate 1 of evaluateV4 pipeline.
 * No action without reasoning.
 * If you can't explain it, you can't do it.
 *
 * Two layers of validation:
 * 1. Field existence — required fields must be present and non-trivial
 * 2. Coherence check — the reasoning chain must be internally consistent
 */
export declare function enforceReasoningFrame(input: {
    reasoningFrame?: ReasoningFrame;
}): ReasoningGateResult;
