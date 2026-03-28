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

export type Evidence = {
  observations?: string[]
  failureSignals?: string[]
  commandResults?: string[]
  fileDiffSummary?: {
    changedFiles: string[]
    sizeDelta?: number
    largeFilesAdded?: number
  }
}

export type Claim = {
  statements: string[]
  confidence?: "low" | "medium" | "high"
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

export type Policy = (input: Input) => Violation[]
