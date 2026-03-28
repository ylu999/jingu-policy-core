import { Input, Violation } from "../../types";
/**
 * P6 — Bounded & Disciplined Execution
 * Rejects proposals that have too many consecutive write/command actions
 * without analysis or read actions interspersed.
 */
export declare const p6BoundedExecution: (input: Input) => Violation[];
