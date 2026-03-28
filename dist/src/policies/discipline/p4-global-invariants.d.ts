import { Input, Violation } from "../../types";
/**
 * P4 — Global Invariants Over Local Progress
 * Rejects or blocks proposals that introduce quick fixes without follow-up plans.
 */
export declare const p4GlobalInvariants: (input: Input) => Violation[];
