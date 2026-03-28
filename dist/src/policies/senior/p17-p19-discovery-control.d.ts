/**
 * P17 — Externalize and Split on Discovery
 * P18 — Blocker Precedence
 * P19 — Context / Scope Budget
 *
 * These three policies form the Discovery Control cluster.
 * They enforce the principle: discovery must become a work item before it becomes an action.
 *
 * Core rule: "New discovery is not permission to expand scope."
 */
import type { Input, Violation } from "../../types.js";
export declare function p17ExternalizeOnDiscovery(input: Input): Violation[];
export declare function p18BlockerPrecedence(input: Input): Violation[];
export declare function p19ContextBudget(input: Input): Violation[];
