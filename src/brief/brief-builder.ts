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

  // renderSection produces no trailing newline, so "\n\n" yields exactly one
  // blank line between sections. Do not add trailing newlines to renderSection.
  return [policiesSection, gatesSection, contextSection].join("\n\n")
}

function renderSection(title: string, items: string[]): string {
  if (items.length === 0) {
    return `## ${title}\n(none)`
  }
  const bullets = items.map((item) => `- ${item}`).join("\n")
  return `## ${title}\n${bullets}`
}
