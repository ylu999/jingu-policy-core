// src/rpp/rpp.failures.ts

import { RPPFailureCode } from "./rpp.types.js"

export type RPPFailureDescription = {
  severity: "error" | "warning"
  description: string
  example: string
}

export const RPP_FAILURE_DESCRIPTIONS: Record<RPPFailureCode, RPPFailureDescription> = {
  // Hard failures (severity: "error") — block execution
  MISSING_STAGE: {
    severity: "error",
    description: "A required cognitive stage (interpretation, reasoning, decision, or action) is absent from the RPP record.",
    example: "RPP record has steps for interpretation and decision but omits the reasoning stage entirely.",
  },
  EMPTY_CONTENT: {
    severity: "error",
    description: "A stage or response step has an empty content array or all content entries are blank strings.",
    example: "The decision stage has content: [] with no entries explaining what was decided.",
  },
  NO_REFERENCES: {
    severity: "error",
    description: "A stage or response step that requires references has none, making the output ungrounded.",
    example: "The response step cites no evidence or rules despite making factual claims.",
  },
  UNTRACEABLE_RESPONSE: {
    severity: "error",
    description: "The final response cannot be traced back to any step in the cognitive chain — no references link response to prior reasoning.",
    example: "Response says 'use method X' but no reasoning or decision step mentions method X.",
  },
  UNJUSTIFIED_DECISION: {
    severity: "error",
    description: "A decision stage has no supporting rule or evidence reference to justify why this decision was made.",
    example: "Decision stage selects option B but provides no rule_id or evidence reference explaining the choice.",
  },
  INVALID_REFERENCE: {
    severity: "error",
    description: "A reference is structurally malformed or points to a non-existent source, rule, or method.",
    example: "A RuleRef has rule_id: '' (empty string) or an EvidenceRef has a locator that does not match any known document.",
  },

  // Soft failures (severity: "warning") — flagged but do not block
  UNSUPPORTED_CLAIM: {
    severity: "warning",
    description: "A content entry makes a factual claim that has no corresponding reference supporting it.",
    example: "Reasoning stage states 'This pattern is always inefficient' but no evidence reference backs that claim.",
  },
  INFERENCE_AS_FACT: {
    severity: "warning",
    description: "An inference or assumption is stated as established fact without acknowledging uncertainty.",
    example: "Content says 'The user intends to deploy to production' without marking it as an inference or listing it in uncertainties.",
  },
  SUPPORTS_TOO_VAGUE: {
    severity: "warning",
    description: "A reference's 'supports' field is too generic to meaningfully trace which claim it backs.",
    example: "EvidenceRef has supports: 'general context' instead of specifying which particular claim it supports.",
  },
  METHOD_NOT_ACTUALLY_USED: {
    severity: "warning",
    description: "A method_ref is declared in a stage but the method's logic is not reflected in the stage's content.",
    example: "Stage declares method_ref for 'cost-benefit-analysis' but the content shows no cost or benefit comparison.",
  },
  CIRCULAR_REFERENCE: {
    severity: "warning",
    description: "Two or more references form a cycle where each claims to support the other with no external grounding.",
    example: "Step A references step B as evidence, and step B references step A as its justification.",
  },
  ACTION_SCOPE_VIOLATION: {
    severity: "warning",
    description: "An action step proposes actions that exceed the scope authorized by the preceding decision stage.",
    example: "Decision stage authorizes 'update config file' but action stage also proposes 'delete the database'.",
  },
}

const HARD_FAILURE_CODES = new Set<RPPFailureCode>([
  "MISSING_STAGE",
  "EMPTY_CONTENT",
  "NO_REFERENCES",
  "UNTRACEABLE_RESPONSE",
  "UNJUSTIFIED_DECISION",
  "INVALID_REFERENCE",
])

export function isHardFailure(code: RPPFailureCode): boolean {
  return HARD_FAILURE_CODES.has(code)
}
