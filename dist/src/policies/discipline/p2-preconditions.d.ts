import { Input, Violation } from "../../types";
/**
 * P2 — Preconditions Before Action
 * Blocks execution when required tools are missing.
 */
export declare const p2Preconditions: (input: Input) => Violation[];
