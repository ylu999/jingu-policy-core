import { Input, Violation } from "../../types";
/**
 * P14 — Minimal Sufficient Intervention
 * Rejects reasoning frames where the proposed intervention is too vague.
 */
export declare const p14MinimalIntervention: (input: Input) => Violation[];
