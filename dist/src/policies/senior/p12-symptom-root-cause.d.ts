import { Input, Violation } from "../../types";
/**
 * P12 — Symptom vs Root Cause Separation
 * Rejects/warns when symptoms, hypotheses, or verified facts are empty.
 */
export declare const p12SymptomRootCause: (input: Input) => Violation[];
