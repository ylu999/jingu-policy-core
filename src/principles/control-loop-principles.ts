/**
 * Control Loop Governance Principles — machine-checkable check functions.
 *
 * Canonical definitions: CONTROL_LOOP_PRINCIPLES.md (same directory)
 * Behavioral guide:      ~/.claude/rules/control-loop-principles.md
 *
 * Four principles:
 *   IGF — Information Gain First
 *   NBR — No Blind Retry
 *   EFR — Execution Feedback Required
 *   DBO — Diagnosis Before Optimization
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ControlLoopPrincipleId = "IGF" | "NBR" | "EFR" | "DBO";

export interface ControlLoopViolation {
  principle: ControlLoopPrincipleId;
  description: string;
  evidence: string;
}

// ── IGF — Information Gain First ──────────────────────────────────────────────

export interface ChangeDescriptor {
  /** True if the change adds observability (new log, new metric, new signal) */
  adds_observability: boolean;
  /** True if the change adds or improves failure signal (new test name, new excerpt) */
  adds_failure_signal: boolean;
  /** True if the change modifies a runtime parameter (step_limit, timeout, workers) */
  changes_runtime_param: boolean;
}

/**
 * IGF: A change that only adjusts runtime parameters without adding observability
 * or failure signal violates Information Gain First.
 */
export function checkInformationGainFirst(
  change: ChangeDescriptor,
): ControlLoopViolation | null {
  if (
    change.changes_runtime_param &&
    !change.adds_observability &&
    !change.adds_failure_signal
  ) {
    return {
      principle: "IGF",
      description:
        "Runtime parameter change without adding observability or failure signal.",
      evidence: `changes_runtime_param=true, adds_observability=${change.adds_observability}, adds_failure_signal=${change.adds_failure_signal}`,
    };
  }
  return null;
}

// ── NBR — No Blind Retry ──────────────────────────────────────────────────────

/**
 * NBR: If attempt > 1, last_failure must be non-empty.
 * An empty retry hint when execution evidence is available is a blind retry.
 */
export function checkNoBlindRetry(
  attempt: number,
  last_failure: string,
): ControlLoopViolation | null {
  if (attempt > 1 && last_failure.trim() === "") {
    return {
      principle: "NBR",
      description: `Attempt ${attempt} has empty last_failure. Retry must be grounded in failure signal.`,
      evidence: `attempt=${attempt}, last_failure=""`,
    };
  }
  return null;
}

// ── EFR — Execution Feedback Required ────────────────────────────────────────

/**
 * EFR: If tests ran in attempt N, execution feedback must be non-empty
 * before attempt N+1 is launched.
 */
export function checkExecutionFeedbackRequired(
  tests_ran: boolean,
  exec_feedback: string,
): ControlLoopViolation | null {
  if (tests_ran && exec_feedback.trim() === "") {
    return {
      principle: "EFR",
      description:
        "Tests ran but execution feedback is empty. Test output must be extracted and fed back.",
      evidence: `tests_ran=true, exec_feedback=""`,
    };
  }
  return null;
}

// ── DBO — Diagnosis Before Optimization ──────────────────────────────────────

export interface FailureClassification {
  /** At least one of these must be present for tuning to be allowed */
  has_failure_type: boolean;         // e.g. "exploration_loop", "wrong_direction"
  has_failing_test_names: boolean;   // at least one FAIL_TO_PASS test name known
  has_execution_excerpt: boolean;    // test output excerpt available
}

/**
 * DBO: Runtime parameter tuning is only allowed when failure is classified.
 * Classification requires at least one concrete observable signal.
 */
export function checkDiagnosisBeforeOptimization(
  tuning_runtime_param: boolean,
  classification: FailureClassification,
): ControlLoopViolation | null {
  if (!tuning_runtime_param) return null;

  const classified =
    classification.has_failure_type ||
    classification.has_failing_test_names ||
    classification.has_execution_excerpt;

  if (!classified) {
    return {
      principle: "DBO",
      description:
        "Runtime parameter tuned without failure classification. Classify failure first.",
      evidence: `tuning_runtime_param=true, has_failure_type=${classification.has_failure_type}, has_failing_test_names=${classification.has_failing_test_names}, has_execution_excerpt=${classification.has_execution_excerpt}`,
    };
  }
  return null;
}

// ── Batch check ───────────────────────────────────────────────────────────────

export interface ControlLoopCheckInput {
  change?: ChangeDescriptor;
  attempt?: number;
  last_failure?: string;
  tests_ran?: boolean;
  exec_feedback?: string;
  tuning_runtime_param?: boolean;
  classification?: FailureClassification;
}

/**
 * Run all applicable checks given the available inputs.
 * Only checks for which inputs are provided are run.
 */
export function checkControlLoop(
  input: ControlLoopCheckInput,
): ControlLoopViolation[] {
  const violations: ControlLoopViolation[] = [];

  if (input.change !== undefined) {
    const v = checkInformationGainFirst(input.change);
    if (v) violations.push(v);
  }

  if (input.attempt !== undefined && input.last_failure !== undefined) {
    const v = checkNoBlindRetry(input.attempt, input.last_failure);
    if (v) violations.push(v);
  }

  if (input.tests_ran !== undefined && input.exec_feedback !== undefined) {
    const v = checkExecutionFeedbackRequired(input.tests_ran, input.exec_feedback);
    if (v) violations.push(v);
  }

  if (
    input.tuning_runtime_param !== undefined &&
    input.classification !== undefined
  ) {
    const v = checkDiagnosisBeforeOptimization(
      input.tuning_runtime_param,
      input.classification,
    );
    if (v) violations.push(v);
  }

  return violations;
}
