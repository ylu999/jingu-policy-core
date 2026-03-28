import { Input, Violation } from "../../types";
/**
 * P15 — Future-State Integrity
 * Warns when no recurrence prevention strategy is documented.
 */
export declare const p15FutureIntegrity: (input: Input) => Violation[];
