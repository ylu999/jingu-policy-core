import { InvariantCodes } from "./codes.js"
import { pass, fail, mergeResults, type InvariantCheckResult } from "./result.js"

export function checkExecutionHasObservableOutput(
  { expected_outputs, observed_outputs }: { expected_outputs: string[]; observed_outputs: string[] }
): InvariantCheckResult {
  if (expected_outputs.length > 0 && observed_outputs.length === 0) {
    return fail({
      code: InvariantCodes.NO_OBSERVABLE_OUTPUT,
      severity: "error",
      message: "Execution produced no observable outputs. Expected outputs were declared but none observed.",
      details: { expected_outputs },
    })
  }
  return pass()
}

export function checkNoOpPolicy(
  { changed_files_count, allow_no_op }: { changed_files_count: number; allow_no_op?: boolean }
): InvariantCheckResult {
  if (changed_files_count === 0 && !allow_no_op) {
    return fail({
      code: InvariantCodes.NO_OP_FORBIDDEN,
      severity: "error",
      message: "Execution changed no files and allow_no_op is not set. A no-op execution is forbidden by policy.",
    })
  }
  return pass()
}

export function checkScope(
  { allowed_files, changed_files }: { allowed_files: string[]; changed_files: string[] }
): InvariantCheckResult {
  // No scope declared = open scope, all changes allowed
  if (allowed_files.length === 0) {
    return pass()
  }
  const illegal = changed_files.filter(f => !allowed_files.includes(f))
  if (illegal.length > 0) {
    return fail({
      code: InvariantCodes.SCOPE_VIOLATION,
      severity: "error",
      message: `Execution modified files outside declared scope: ${illegal.join(", ")}`,
      details: { illegal_paths: illegal, allowed_files },
    })
  }
  return pass()
}

export function checkFailuresAreTyped(
  { failures }: { failures: Array<{ code?: string }> }
): InvariantCheckResult {
  const untyped = failures.filter(f => f.code == null || f.code === "")
  if (untyped.length > 0) {
    return fail({
      code: InvariantCodes.NON_TYPED_FAILURE,
      severity: "error",
      message: `${untyped.length} failure(s) are missing a typed code. Every failure must have an explicit error code.`,
      details: { untyped_count: untyped.length },
    })
  }
  return pass()
}

export function validateRuntimeExecution(input: {
  expected_outputs: string[]
  observed_outputs: string[]
  changed_files_count: number
  allow_no_op?: boolean
  allowed_files: string[]
  changed_files: string[]
  failures: Array<{ code?: string }>
}): InvariantCheckResult {
  return mergeResults([
    checkExecutionHasObservableOutput({ expected_outputs: input.expected_outputs, observed_outputs: input.observed_outputs }),
    checkNoOpPolicy({ changed_files_count: input.changed_files_count, allow_no_op: input.allow_no_op }),
    checkScope({ allowed_files: input.allowed_files, changed_files: input.changed_files }),
    checkFailuresAreTyped({ failures: input.failures }),
  ])
}
