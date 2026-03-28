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

import type { Input, Violation, Discovery } from "../../types.js"

// ---------------------------------------------------------------------------
// P17 — Externalize and Split on Discovery
//
// When new findings emerge, the agent must externalize them as explicit
// Discovery records before acting on them.
//
// Detects:
//   - Proposal acts on findings that haven't been recorded as discoveries
//   - Multiple concurrent findings being absorbed directly into the proposal
//   - Discovery of blocker-like conditions without classification
// ---------------------------------------------------------------------------

export function p17ExternalizeOnDiscovery(input: Input): Violation[] {
  const violations: Violation[] = []
  const { proposal, evidence, discoveries = [] } = input

  // Detect 1: Proposal changes multiple subsystems with no discovery record
  // Heuristic: if proposal touches 3+ intent-distinct areas and no discoveries recorded,
  // agent is silently absorbing multiple findings
  const intentAreas = extractIntentAreas(proposal.plannedActions.map(a => a.intent))
  if (intentAreas.size >= 3 && discoveries.length === 0) {
    violations.push({
      policyId: "P17",
      severity: "warning",
      message: `Proposal spans ${intentAreas.size} distinct concern areas (${[...intentAreas].join(", ")}) without any externalized discoveries. When multiple findings emerge, record them as discoveries before acting.`,
    })
  }

  // Detect 2: Evidence contains multiple failure signals but no discovery records
  // Signals that agent saw multiple issues but didn't externalize them
  const failureSignals = evidence?.failureSignals ?? []
  if (failureSignals.length >= 2 && discoveries.length === 0) {
    violations.push({
      policyId: "P17",
      severity: "reject",
      message: `${failureSignals.length} failure signals detected in evidence but no discoveries recorded. Each significant finding must be externalized as a discovery (blocker / followup / separate_task) before action.`,
    })
  }

  // Detect 3: Discovery recorded but not classified (type missing or summary too short)
  for (const d of discoveries) {
    if (!d.type) {
      violations.push({
        policyId: "P17",
        severity: "warning",
        message: `Discovery "${d.id}" has no type. Classify it as 'blocker', 'followup', or 'separate_task' so the system can route it correctly.`,
      })
    }
    if (!d.summary || d.summary.trim().length < 10) {
      violations.push({
        policyId: "P17",
        severity: "warning",
        message: `Discovery "${d.id}" has an insufficient summary. Describe what was found so it can be acted on or delegated.`,
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// P18 — Blocker Precedence
//
// Once a blocking condition is discovered, downstream execution must pause.
// The blocker must be resolved or explicitly deferred before the original
// execution continues.
//
// Detects:
//   - Discovery records with type="blocker" but resolvedInline=false
//     while proposal still proceeds with original plan
//   - Failure signals indicating prerequisite failure while proposal
//     proceeds as if they don't exist
// ---------------------------------------------------------------------------

export function p18BlockerPrecedence(input: Input): Violation[] {
  const violations: Violation[] = []
  const { proposal, evidence, discoveries = [] } = input

  // Detect 1: Unresolved blocker in discovery records while proposal proceeds
  const unresolvedBlockers = discoveries.filter(
    d => d.type === "blocker" && !d.resolvedInline
  )
  if (unresolvedBlockers.length > 0) {
    const blockerIds = unresolvedBlockers.map(d => d.id).join(", ")
    const blockerSummaries = unresolvedBlockers.map(d => d.summary).join("; ")
    violations.push({
      policyId: "P18",
      severity: "block",
      message: `Execution blocked: ${unresolvedBlockers.length} unresolved blocker(s) detected (${blockerIds}): "${blockerSummaries}". Resolve or explicitly defer blockers before continuing original execution.`,
    })
  }

  // Detect 2: Classic blocker signals in evidence while proposal proceeds with mutating actions
  // These signals indicate a gating precondition is missing
  const classicBlockers: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /not.found|not.installed|command.not.found|not.in.path/i, label: "tool not found" },
    { pattern: /permission.denied|access.denied|unauthorized/i, label: "permission denied" },
    { pattern: /not.authenticated|auth.failed|token.expired/i, label: "authentication failure" },
    { pattern: /disk.full|no.space.left|quota.exceeded/i, label: "disk full" },
    { pattern: /schema.mismatch|schema.invalid|migration.pending/i, label: "schema mismatch" },
    { pattern: /merge.conflict|conflict.with|cannot.merge/i, label: "merge conflict" },
    { pattern: /repo.dirty|uncommitted.changes|working.tree.dirty/i, label: "dirty repo state" },
  ]

  const hasMutatingActions = proposal.plannedActions.some(
    a => a.type === "write" || a.type === "command"
  )

  if (hasMutatingActions) {
    const allSignalText = [
      ...(evidence?.failureSignals ?? []),
      ...(evidence?.observations ?? []),
      ...(evidence?.commandResults ?? []),
    ].join(" ").toLowerCase()

    for (const { pattern, label } of classicBlockers) {
      if (pattern.test(allSignalText)) {
        violations.push({
          policyId: "P18",
          severity: "block",
          message: `Execution blocked: evidence contains "${label}" signal while proposal proceeds with mutating actions. Resolve the blocking condition first.`,
        })
      }
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// P19 — Context / Scope Budget
//
// A task must remain within a manageable execution boundary.
// When discoveries expand scope beyond that boundary, the task must be split.
//
// Detects:
//   - Too many open branches / hypotheses being tracked simultaneously
//   - Proposal touching too many distinct subsystems
//   - Too many concurrent discoveries without resolution
//   - Proposal intent suggests multi-problem bundle
// ---------------------------------------------------------------------------

const MAX_OPEN_BRANCHES = 5
const MAX_CONCURRENT_FINDINGS = 3
const MAX_SUBSYSTEMS_IN_ONE_PROPOSAL = 3

export function p19ContextBudget(input: Input): Violation[] {
  const violations: Violation[] = []
  const { proposal, executionBudget, discoveries = [] } = input

  // Detect 1: Explicit budget signals exceeded
  if (executionBudget) {
    if ((executionBudget.openBranches ?? 0) > MAX_OPEN_BRANCHES) {
      violations.push({
        policyId: "P19",
        severity: "reject",
        message: `Context budget exceeded: ${executionBudget.openBranches} open branches (max ${MAX_OPEN_BRANCHES}). Split the task — keep the active execution path narrow and create subtasks for other branches.`,
      })
    }

    if ((executionBudget.concurrentFindings ?? 0) > MAX_CONCURRENT_FINDINGS) {
      violations.push({
        policyId: "P19",
        severity: "reject",
        message: `Context budget exceeded: ${executionBudget.concurrentFindings} concurrent findings being tracked (max ${MAX_CONCURRENT_FINDINGS}). Externalize extra findings as separate tasks before continuing.`,
      })
    }

    const subsystems = executionBudget.subsystemsTouched ?? []
    if (subsystems.length > MAX_SUBSYSTEMS_IN_ONE_PROPOSAL) {
      violations.push({
        policyId: "P19",
        severity: "warning",
        message: `Proposal touches ${subsystems.length} subsystems (${subsystems.join(", ")}) — exceeds budget of ${MAX_SUBSYSTEMS_IN_ONE_PROPOSAL}. Consider splitting into focused subtasks.`,
      })
    }
  }

  // Detect 2: Many unresolved discoveries accumulate without resolution
  const unresolvedNonBlockers = discoveries.filter(
    d => d.type !== "blocker" && !d.resolvedInline && !d.spawnSuggested
  )
  if (unresolvedNonBlockers.length > MAX_CONCURRENT_FINDINGS) {
    violations.push({
      policyId: "P19",
      severity: "warning",
      message: `${unresolvedNonBlockers.length} unresolved discoveries accumulating without spawn or resolution plan. Mark them for spawn or explicitly defer before continuing.`,
    })
  }

  // Detect 3: Proposal actions span many distinct intent areas (heuristic)
  const intentAreas = extractIntentAreas(proposal.plannedActions.map(a => a.intent))
  if (intentAreas.size > MAX_SUBSYSTEMS_IN_ONE_PROPOSAL + 1) {
    violations.push({
      policyId: "P19",
      severity: "warning",
      message: `Proposal actions span ${intentAreas.size} concern areas (${[...intentAreas].join(", ")}). When a single proposal covers many distinct concerns, it's a signal to split.`,
    })
  }

  return violations
}

// --- helpers ---

// Extracts broad concern areas from action intent strings
// Uses keyword clustering to identify distinct problem domains
function extractIntentAreas(intents: string[]): Set<string> {
  const areas = new Set<string>()
  const combined = intents.join(" ").toLowerCase()

  if (/test|spec|assert|coverage/.test(combined)) areas.add("testing")
  if (/deploy|infra|terraform|kubernetes|docker|cloud/.test(combined)) areas.add("infrastructure")
  if (/database|migration|schema|query|sql/.test(combined)) areas.add("database")
  if (/auth|permission|role|token|credential/.test(combined)) areas.add("auth")
  if (/lint|format|style|eslint|prettier/.test(combined)) areas.add("style")
  if (/docs|readme|comment|documentation/.test(combined)) areas.add("documentation")
  if (/ci|pipeline|workflow|github.action|build/.test(combined)) areas.add("ci")
  if (/config|env|setting|environment/.test(combined)) areas.add("config")
  if (/api|endpoint|route|handler/.test(combined)) areas.add("api")
  if (/cache|redis|memcach/.test(combined)) areas.add("cache")
  if (/network|firewall|dns|port/.test(combined)) areas.add("network")
  if (/package|dependency|npm|yarn|install/.test(combined)) areas.add("dependencies")

  return areas
}
