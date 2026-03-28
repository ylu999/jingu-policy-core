import { Input, Violation } from "../../types";
/**
 * P8 — Claim Honesty
 * Rejects strong completion claims when there is no supporting evidence.
 */
export declare const p8ClaimHonesty: (input: Input) => Violation[];
