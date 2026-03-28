import type { Policy, Violation, Input } from "./types"

// ─── P1: Constraint Bypass ───────────────────────────────────────────────────
// Agent proposes actions that violate explicit task constraints
export const P1: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const constraints = input.task.constraints
  if (!constraints) return violations

  const requiredTools = constraints.requiredTools ?? []
  const explicitConstraints = constraints.explicitConstraints ?? []
  const forbiddenPatterns = constraints.forbiddenPatterns ?? []

  for (const action of input.proposal.plannedActions) {
    // Check if action uses a forbidden pattern
    for (const pattern of forbiddenPatterns) {
      const cmd = (action.command ?? "").toLowerCase()
      const intent = action.intent.toLowerCase()
      if (cmd.includes(pattern.toLowerCase()) || intent.includes(pattern.toLowerCase())) {
        violations.push({
          policyId: "P1",
          severity: "block",
          message: `Action violates forbidden pattern "${pattern}": ${action.command ?? action.intent}`,
        })
      }
    }

    // Check if command-type action uses a tool NOT in requiredTools list
    // (requiredTools acts as an allow-list when explicitConstraints mentions them)
    if (action.type === "command" && requiredTools.length > 0) {
      const cmd = (action.command ?? "").toLowerCase()
      const usesRequiredTool = requiredTools.some(t => cmd.includes(t.toLowerCase()))
      if (!usesRequiredTool) {
        violations.push({
          policyId: "P1",
          severity: "block",
          message: `Command "${action.command}" bypasses required-tool constraint. Allowed tools: ${requiredTools.join(", ")}`,
        })
      }
    }

    // Check explicit constraint labels (e.g. "terraform_only")
    for (const constraint of explicitConstraints) {
      if (constraint.endsWith("_only")) {
        const requiredTool = constraint.replace("_only", "")
        if (action.type === "command") {
          const cmd = (action.command ?? "").toLowerCase()
          if (!cmd.includes(requiredTool.toLowerCase())) {
            // already covered by requiredTools check above, skip duplicate
          }
        }
      }
    }
  }

  return violations
}

// ─── P2: Missing Precondition Check ──────────────────────────────────────────
// Agent proceeds without verifying required preconditions
export const P2: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const evidence = input.evidence

  // If there are failure signals and no analysis actions before command actions,
  // the agent is skipping precondition checks
  if (evidence?.failureSignals && evidence.failureSignals.length > 0) {
    const hasAnalysis = input.proposal.plannedActions.some(
      a => a.type === "analysis" || a.type === "read"
    )
    if (!hasAnalysis) {
      violations.push({
        policyId: "P2",
        severity: "reject",
        message: "Failure signals present but proposal lacks precondition analysis step",
      })
    }
  }

  return violations
}

// ─── P3: Blind Retry ─────────────────────────────────────────────────────────
// Agent retries the same failing action without diagnosis
export const P3: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const failureSignals = input.evidence?.failureSignals ?? []

  // Detect repeated identical failure signals (e.g. ["same_failure", "same_failure"])
  const seen = new Map<string, number>()
  for (const signal of failureSignals) {
    seen.set(signal, (seen.get(signal) ?? 0) + 1)
  }

  for (const [signal, count] of seen) {
    if (count >= 2) {
      violations.push({
        policyId: "P3",
        severity: "block",
        message: `Blind retry detected: failure signal "${signal}" repeated ${count} times without resolution`,
      })
      break
    }
  }

  return violations
}

// ─── P4: Scope Escape ─────────────────────────────────────────────────────────
// Agent touches files/resources outside allowed mutation scope
export const P4: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const allowedScope = input.task.constraints?.allowedMutationScope
  if (!allowedScope || allowedScope.length === 0) return violations

  const changedFiles = input.evidence?.fileDiffSummary?.changedFiles ?? []
  for (const file of changedFiles) {
    const inScope = allowedScope.some(scope => file.startsWith(scope))
    if (!inScope) {
      violations.push({
        policyId: "P4",
        severity: "reject",
        message: `File "${file}" is outside allowed mutation scope: ${allowedScope.join(", ")}`,
      })
    }
  }

  return violations
}

// ─── P5: Underdefined Plan ────────────────────────────────────────────────────
// Agent's proposal lacks sufficient detail to be executable
export const P5: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const actions = input.proposal.plannedActions

  if (actions.length === 0) {
    violations.push({
      policyId: "P5",
      severity: "reject",
      message: "Proposal has no planned actions",
    })
    return violations
  }

  for (const action of actions) {
    if (!action.intent || action.intent.trim().length === 0) {
      violations.push({
        policyId: "P5",
        severity: "warning",
        message: `Action of type "${action.type}" has no stated intent`,
      })
    }
  }

  return violations
}

// ─── P6: Unverified Mutation ──────────────────────────────────────────────────
// Agent applies mutations without verification evidence
export const P6: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const hasWriteAction = input.proposal.plannedActions.some(a => a.type === "write")
  if (!hasWriteAction) return violations

  const hasEvidence =
    (input.evidence?.observations?.length ?? 0) > 0 ||
    (input.evidence?.commandResults?.length ?? 0) > 0

  if (!hasEvidence) {
    violations.push({
      policyId: "P6",
      severity: "warning",
      message: "Write actions proposed without supporting evidence or prior observations",
    })
  }

  return violations
}

// ─── P7: Hygiene Violation ────────────────────────────────────────────────────
// Agent introduces repo hygiene issues (large files, generated artifacts, etc.)
export const P7: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const diff = input.evidence?.fileDiffSummary
  if (!diff) return violations

  const SIZE_LIMIT = 10_000_000 // 10MB

  if ((diff.sizeDelta ?? 0) > SIZE_LIMIT) {
    violations.push({
      policyId: "P7",
      severity: "block",
      message: `Repo size delta ${diff.sizeDelta} bytes exceeds hygiene limit (${SIZE_LIMIT} bytes). Likely committing generated/vendor artifacts.`,
    })
  }

  if ((diff.largeFilesAdded ?? 0) > 0) {
    violations.push({
      policyId: "P7",
      severity: "reject",
      message: `${diff.largeFilesAdded} large file(s) added to repository`,
    })
  }

  return violations
}

// ─── P8: Claim Inflation ──────────────────────────────────────────────────────
// Agent's claim exceeds what evidence supports
export const P8: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []
  const claim = input.claim
  if (!claim || claim.statements.length === 0) return violations

  const evidence = input.evidence
  const evidenceCount =
    (evidence?.observations?.length ?? 0) +
    (evidence?.commandResults?.length ?? 0)

  // More claims than evidence items = inflation
  if (claim.statements.length > Math.max(evidenceCount, 1) && evidenceCount === 0) {
    violations.push({
      policyId: "P8",
      severity: "reject",
      message: `Claim makes ${claim.statements.length} statement(s) but no supporting evidence provided`,
    })
  }

  return violations
}

// ─── P9: Search Without Reasoning ────────────────────────────────────────────
// Agent issues search/read actions without stating a hypothesis
export const P9: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []

  for (const action of input.proposal.plannedActions) {
    if (action.type === "search" || action.type === "read") {
      if (!action.hypothesis) {
        violations.push({
          policyId: "P9",
          severity: "warning",
          message: `${action.type} action "${action.query ?? action.intent}" has no hypothesis — searching without reasoning`,
        })
      }
    }
  }

  return violations
}

// ─── P10: Missing Core Tension (Senior) ──────────────────────────────────────
export const P10: Policy = (input: Input): Violation[] => {
  if (!input.reasoningFrame) return []
  if (!input.reasoningFrame.coreTension || input.reasoningFrame.coreTension.trim().length < 10) {
    return [{
      policyId: "P10",
      severity: "reject",
      message: "Reasoning frame missing core tension — senior engineers articulate the fundamental constraint conflict",
    }]
  }
  return []
}

// ─── P11: Problem Layer Unidentified (Senior) ─────────────────────────────────
export const P11: Policy = (input: Input): Violation[] => {
  if (!input.reasoningFrame) return []
  if (input.reasoningFrame.problemLayer === "unknown") {
    return [{
      policyId: "P11",
      severity: "reject",
      message: "Problem layer not identified — classify as requirements/architecture/environment/state/execution",
    }]
  }
  return []
}

// ─── P12: No Hypotheses (Senior) ─────────────────────────────────────────────
export const P12: Policy = (input: Input): Violation[] => {
  if (!input.reasoningFrame) return []
  if (input.reasoningFrame.hypotheses.length === 0) {
    return [{
      policyId: "P12",
      severity: "reject",
      message: "No hypotheses in reasoning frame — senior engineers form and test hypotheses before acting",
    }]
  }
  return []
}

// ─── P13: No Tradeoffs Considered (Senior) ────────────────────────────────────
export const P13: Policy = (input: Input): Violation[] => {
  if (!input.reasoningFrame) return []
  if (input.reasoningFrame.tradeoffs.length === 0) {
    return [{
      policyId: "P13",
      severity: "reject",
      message: "No tradeoffs considered — senior engineers explicitly weigh competing options",
    }]
  }
  return []
}

// ─── P14: No Intervention Stated (Senior) ────────────────────────────────────
export const P14: Policy = (input: Input): Violation[] => {
  if (!input.reasoningFrame) return []
  if (!input.reasoningFrame.proposedIntervention || input.reasoningFrame.proposedIntervention.trim().length < 5) {
    return [{
      policyId: "P14",
      severity: "warning",
      message: "Proposed intervention not clearly stated in reasoning frame",
    }]
  }
  return []
}

// ─── P15: No Recurrence Prevention (Senior) ──────────────────────────────────
export const P15: Policy = (input: Input): Violation[] => {
  if (!input.reasoningFrame) return []
  if (!input.reasoningFrame.recurrencePrevention) {
    return [{
      policyId: "P15",
      severity: "warning",
      message: "No recurrence prevention strategy — senior engineers close systemic gaps",
    }]
  }
  return []
}

// ─── P16: Externalize Working Context (Senior) ───────────────────────────────
// Agent acts without externalizing working context to durable artifacts
export const P16: Policy = (input: Input): Violation[] => {
  const violations: Violation[] = []

  const hasWriteOrCommand = input.proposal.plannedActions.some(
    a => a.type === "write" || a.type === "command"
  )
  const hasContextRef =
    input.evidence?.observations?.some(o =>
      o.toLowerCase().includes(".jingu/context") ||
      o.toLowerCase().includes("active-task") ||
      o.toLowerCase().includes("working context")
    ) ||
    input.evidence?.commandResults?.some(r =>
      r.toLowerCase().includes(".jingu/context") ||
      r.toLowerCase().includes("active-task")
    )

  if (hasWriteOrCommand && !hasContextRef && !input.reasoningFrame?.coreTension) {
    violations.push({
      policyId: "P16",
      severity: "reject",
      message:
        "Context not externalized before action. Write working context (facts, hypotheses, plan, next step) to .jingu/context/ before proposing mutations.",
    })
  }

  const sameFailures = (input.evidence?.failureSignals || []).filter(
    f => f === "same_failure"
  ).length
  if (sameFailures >= 2) {
    const contextUpdated =
      input.evidence?.observations?.some(o =>
        o.toLowerCase().includes("updated context") ||
        o.toLowerCase().includes("context updated") ||
        o.toLowerCase().includes("active-task updated")
      )
    if (!contextUpdated) {
      violations.push({
        policyId: "P16",
        severity: "reject",
        message:
          "Retry detected without updating working context. Before retrying, update .jingu/context/active-task with new failure facts and revised hypotheses.",
      })
    }
  }

  const hasClaim = (input.claim?.statements || []).some(s => {
    const lower = s.toLowerCase()
    return (
      lower.includes("completed") ||
      lower.includes("resolved") ||
      lower.includes("done") ||
      lower.includes("fixed") ||
      lower.includes("deployed")
    )
  })
  const hasEvidenceSummary =
    (input.evidence?.commandResults || []).length > 0 ||
    input.evidence?.observations?.some(o =>
      o.toLowerCase().includes("evidence") ||
      o.toLowerCase().includes("verified") ||
      o.toLowerCase().includes("confirmed")
    )

  if (hasClaim && !hasEvidenceSummary) {
    violations.push({
      policyId: "P16",
      severity: "reject",
      message:
        "Completion claim made without durable evidence summary. Write final working state and evidence refs to .jingu/context/ before claiming completion.",
    })
  }

  const frame = input.reasoningFrame
  if (frame) {
    const isHollow =
      frame.coreTension.length < 10 &&
      frame.symptoms.length === 0 &&
      frame.hypotheses.length === 0 &&
      frame.verifiedFacts.length === 0

    if (isHollow) {
      violations.push({
        policyId: "P16",
        severity: "warning",
        message:
          "ReasoningFrame exists but is empty — working context not externalized. Fill in known facts, hypotheses, and current plan.",
      })
    }
  }

  return violations
}

// ─── Policy Collections ───────────────────────────────────────────────────────
export const allPolicies: Policy[] = [P1, P2, P3, P4, P5, P6, P7, P8, P9]

export const seniorPolicies: Policy[] = [P10, P11, P12, P13, P14, P15, P16]

export const disciplinePolicies: Policy[] = [...allPolicies, ...seniorPolicies]

// ─── Named aliases (descriptive names) ───────────────────────────────────────
export const p1ConstraintObedience = P1
export const p2Preconditions = P2
export const p3FailureClassification = P3
export const p4GlobalInvariants = P4
export const p5RespectAuthority = P5
export const p6BoundedExecution = P6
export const p7Hygiene = P7
export const p8ClaimHonesty = P8
export const p9HypothesisSearch = P9
export const p10CoreTension = P10
export const p11LayerDiagnosis = P11
export const p12SymptomRootCause = P12
export const p13Tradeoff = P13
export const p14MinimalIntervention = P14
export const p15FutureIntegrity = P15
export const p16ExternalizeContext = P16
