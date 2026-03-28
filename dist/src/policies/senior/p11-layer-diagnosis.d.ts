import { Input, Violation } from "../../types";
/**
 * P11 — Correct Layer Diagnosis
 * Rejects reasoning frames where the problem layer is "unknown".
 */
export declare const p11LayerDiagnosis: (input: Input) => Violation[];
