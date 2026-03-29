export type Severity = "warning" | "reject" | "block"

export type Violation = {
  policyId: string
  severity: Severity
  message: string
}

export type ProblemLayer =
  | "requirements"
  | "architecture"
  | "environment"
  | "state"
  | "execution"
  | "unknown"

export type Action = {
  type: "read" | "write" | "command" | "analysis" | "search"
  command?: string
  query?: string
  intent: string
  hypothesis?: string
}

export type Proposal = {
  summary: string
  plannedActions: Action[]
  reasoning?: string
}

// ---------------------------------------------------------------------------
// Evidence — typed facts (v1: backward-compatible, adds typed items alongside
// the legacy string arrays)
// ---------------------------------------------------------------------------

export type EvidenceType =
  | "observation"       // something directly seen/read
  | "measurement"       // a numeric or threshold-bound reading
  | "test_result"       // pass/fail outcome from a test run
  | "command_output"    // stdout/stderr from a command
  | "file_content"      // contents/diff of a file

export type TypedEvidenceItem = {
  id: string
  type: EvidenceType
  value: string           // human-readable summary
  groundTruth?: string    // machine-checkable fact, e.g. exit code, regex match
  source?: string         // where this came from (file path, URL, command)
}

export type Evidence = {
  // Legacy fields — kept for backward-compat; prefer `items` for new code
  observations?: string[]
  failureSignals?: string[]
  commandResults?: string[]
  fileDiffSummary?: {
    changedFiles: string[]
    sizeDelta?: number
    largeFilesAdded?: number
  }
  // Typed evidence items (v1 addition)
  items?: TypedEvidenceItem[]
}

// ---------------------------------------------------------------------------
// Claim — typed assertions (v1: backward-compatible, adds structured claims
// alongside the legacy string array)
// ---------------------------------------------------------------------------

export type ClaimType =
  | "hypothesis"    // a proposed explanation for observed symptoms
  | "diagnosis"     // a concluded root-cause identification
  | "plan"          // a set of intended actions
  | "tradeoff"      // an explicit options comparison
  | "completion"    // a claim that a task or subtask is done

export type TypedClaim = {
  id: string
  type: ClaimType
  text: string
  evidenceRefs: string[]   // IDs of TypedEvidenceItem that support this claim
  confidence?: "low" | "medium" | "high"
}

export type Claim = {
  // Legacy field — kept for backward-compat; prefer `typed` for new code
  statements: string[]
  confidence?: "low" | "medium" | "high"
  // Typed claims (v1 addition)
  typed?: TypedClaim[]
}

export type ReasoningFrame = {
  coreTension: string
  problemLayer: ProblemLayer
  symptoms: string[]
  hypotheses: string[]
  verifiedFacts: string[]
  rootCauseCandidate?: string
  tradeoffs: string[]
  proposedIntervention: string
  recurrencePrevention?: string

  nextStep?: string          // 下一步（enforceReasoningFrame 会强制要求）
}

export type TaskContract = {
  objective: string
  constraints?: {
    explicitConstraints?: string[]
    requiredTools?: string[]
    allowedMutationScope?: string[]
    forbiddenPatterns?: string[]
  }
  successCriteria?: string[]
}

// Discovery: a new finding that emerged during execution
// Must be externalized and classified before action is taken (P17)
export type DiscoveryType = "blocker" | "followup" | "separate_task"

export type Discovery = {
  id: string
  summary: string
  type: DiscoveryType
  impact?: string
  evidence?: string[]
  spawnSuggested?: boolean
  resolvedInline?: boolean  // true only if discovery was handled inline (rare, must be justified)
}

// ExecutionBudget: tracks scope and context load signals (P19)
export type ExecutionBudget = {
  openBranches?: number        // number of unresolved hypotheses / branches being tracked
  concurrentFindings?: number  // number of new discoveries in this execution pass
  subsystemsTouched?: string[] // subsystems the proposal intends to change
}

export type Input = {
  task: TaskContract
  proposal: Proposal
  evidence?: Evidence
  claim?: Claim
  reasoningFrame?: ReasoningFrame
  discoveries?: Discovery[]          // P17/P18: externalized discoveries
  executionBudget?: ExecutionBudget  // P19: scope load signals
}

// ---------------------------------------------------------------------------
// Policy types
// ---------------------------------------------------------------------------

// Classic policy — runs on the full Input unconditionally
export type Policy = (input: Input) => Violation[]

// Typed policy — declares which ClaimTypes it applies to; evaluated only when
// the input contains a typed claim of a matching type.
// Policies that don't depend on typed claims should remain plain Policy.
export type TypedPolicy = {
  appliesTo: ClaimType[]
  check: (claim: TypedClaim, evidence: Evidence | undefined, input: Input) => Violation[]
}
