import { Input, Violation } from "../../types";
/**
 * P3 — Failure Classification Before Retry
 * Rejects proposals that retry without classifying the failure first.
 */
export declare const p3FailureClassification: (input: Input) => Violation[];
