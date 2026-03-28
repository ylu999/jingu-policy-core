import { Input, Violation } from "../../types";
/**
 * P9 — Hypothesis-Driven Search
 * Rejects search actions that lack a stated hypothesis.
 */
export declare const p9HypothesisSearch: (input: Input) => Violation[];
