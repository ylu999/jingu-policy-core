import type { Input, Violation } from "./types";
export type ReasoningGateResult = {
    decision: "accept";
} | {
    decision: "reject";
    reason: string;
    requiredFix: string[];
};
export type V4RegimeResult = {
    stage: "regime";
    decision: "accept" | "reject" | "block";
    score: number;
    violations: Violation[];
    reasoningViolations: Violation[];
    summary: string;
};
export type V4ReasoningRejectResult = {
    stage: "reasoning";
    decision: "reject";
    reason: string;
    requiredFix: string[];
};
export type V4StageResult = V4ReasoningRejectResult | V4RegimeResult;
/**
 * evaluateV4
 *
 * Full pipeline:
 * 1. enforceReasoningFrame — must pass before ANY regime evaluation
 * 2. Regime evaluation — P1-P16 discipline + senior reasoning
 *
 * "No action without reasoning."
 */
export declare function evaluateV4(input: Input): V4StageResult;
export declare const evaluateV4Sync: typeof evaluateV4;
