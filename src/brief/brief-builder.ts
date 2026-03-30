// brief-builder.ts
// Unit 0.2: Brief Builder
//
// Takes an ExecutionConfig (output of Unit 0.1 PolicyResolver) and returns
// a structured plain-text brief string for injection into LLM prompts.
// No LLM calls. No I/O. Pure function.

import { ExecutionConfig } from "../resolver/policy-resolver.js"

export type BriefString = string

export function buildBrief(config: ExecutionConfig): string {
  // == null catches both null and undefined in one guard
  if (config == null) {
    throw new Error("buildBrief: config is required")
  }

  // Section 1: ACTIVE POLICIES
  // Collect all policy strings from all active packs in order.
  // No deduplication — repeated policies reinforce the constraint.
  const allPolicies: string[] = []
  for (const pack of config.active_packs) {
    for (const policy of pack.policies) {
      allPolicies.push(policy)
    }
  }
  const policiesSection = renderSection("ACTIVE POLICIES", allPolicies)

  // Section 2: REQUIRED GATES
  // Already deduplicated by the resolver.
  const gatesSection = renderSection("REQUIRED GATES", config.required_gates)

  // Section 3: EXECUTION CONTEXT
  // Not rendered via renderSection — this section is key-value pairs, not a
  // bullet list of items. renderSection assumes a list; inlining keeps it clear.
  const contextLines = [
    `Execution mode: ${config.execution_mode}`,
    `Reviewer mode: ${config.reviewer_mode}`,
  ]
  const contextSection = `## EXECUTION CONTEXT\n${contextLines.join("\n")}`

  // Section 4: OUTPUT CONTRACT (BL-004 partial, BL-014 enforcement)
  // Requires proposer to output RPP JSON v1. schema_version is required at runtime.
  const contractLines = [
    `Respond with a single JSON object matching the RPP schema v1.`,
    `Do not include any prose outside the JSON object.`,
    `Required top-level fields: schema_version ("rpp.v1"), call_id, steps, response.`,
    `steps must contain exactly 4 objects with ids "s1", "s2", "s3", "s4" and stages "interpretation", "reasoning", "decision", "action" — in that order.`,
    `Each step must have: id (string), stage (one of the four above), content (array of strings), references (array of reference objects).`,
    `All references must be valid: non-empty supports field; rule_id matches RUL-NNN; method_id matches XXX-NNN.`,
    `response.references must contain at least one entry with type "derived" and from_steps listing step ids from your steps array.`,
    `CRITICAL — from_steps rule: every value in from_steps must be an id that exists in your steps array ("s1", "s2", "s3", or "s4"). Never invent ids.`,
  ]
  // Inline example so the model can pattern-match, not just follow abstract rules.
  const contractExample = `\n## OUTPUT CONTRACT EXAMPLE\n` +
    `{"schema_version":"rpp.v1","call_id":"c1","steps":[` +
    `{"id":"s1","stage":"interpretation","content":["I understand the task."],"references":[{"type":"evidence","source":"user_input","locator":"message","supports":"task description"}]},` +
    `{"id":"s2","stage":"reasoning","content":["Analysis here."],"references":[{"type":"method","method_id":"RCA-001","supports":"root cause reasoning"}]},` +
    `{"id":"s3","stage":"decision","content":["I will do X."],"references":[{"type":"rule","rule_id":"RUL-001","supports":"decision rule"}]},` +
    `{"id":"s4","stage":"action","content":["Taking action."],"references":[{"type":"evidence","source":"file","locator":"src/foo.ts:10","supports":"file being acted on"}]}` +
    `],"response":{"content":["Summary."],"references":[{"type":"derived","from_steps":["s3","s4"],"supports":"derived from decision and action"}]}}`
  const contractSection = `## OUTPUT CONTRACT\n${contractLines.map((l) => `- ${l}`).join("\n")}` + contractExample

  // renderSection produces no trailing newline, so "\n\n" yields exactly one
  // blank line between sections. Do not add trailing newlines to renderSection.
  return [policiesSection, gatesSection, contextSection, contractSection].join("\n\n")
}

function renderSection(title: string, items: string[]): string {
  if (items.length === 0) {
    return `## ${title}\n(none)`
  }
  const bullets = items.map((item) => `- ${item}`).join("\n")
  return `## ${title}\n${bullets}`
}
