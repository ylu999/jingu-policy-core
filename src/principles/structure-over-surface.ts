/**
 * Machine-checkable counterpart to .claude/rules/structure-over-surface.md.
 *
 * Two principles:
 *   P1. STRUCTURE_OVER_SURFACE    — judge via parsed structure, not surface text patterns
 *   P2. VERIFY_SEMANTICS_NOT_FORMAT — validate semantics, not formatting
 *
 * These checks operate on the SOURCE TEXT of gate/validator implementations,
 * not on runtime data. They are static analysis invariants.
 *
 * Principle: STRUCTURE_OVER_SURFACE
 * Systems must judge correctness based on parsed structure (e.g. RPPRecord),
 * never based on surface text patterns (regex, keyword matching, format checks).
 *
 * Surface text can be trivially faked by an LLM.
 * Structural properties are verifiable and harder to fake.
 */

import {
  type InvariantCheckResult,
  type InvariantFailure,
  pass,
  fail,
  mergeResults,
} from "../invariants/index.js"
import { InvariantCodes } from "../invariants/codes.js"

// ---------------------------------------------------------------------------
// Types for static gate analysis
// ---------------------------------------------------------------------------

export type GateAnalysisInput = {
  /** Gate identifier */
  gate_id: string
  /** True if this gate has any code path that accesses ctx.rpp or a parsed RPP object */
  has_rpp_check: boolean
  /** True if this gate uses regex, includes(), or indexOf() on the raw llm_output string */
  has_surface_pattern: boolean
  /**
   * True if the surface pattern is ONLY used in a fallback block that is
   * explicitly gated on rpp being null/unavailable.
   */
  surface_is_fallback_only: boolean
}

export type ValidatorAnalysisInput = {
  /** Validator or check function identifier */
  validator_id: string
  /**
   * True if any check uses string/array .length as a quality proxy
   * (e.g. supports.length < 8, content.length === 0 without further checks)
   */
  uses_length_proxy: boolean
  /**
   * True if any ID validation uses regex format matching instead of
   * registry/set lookup (e.g. /^RUL-\d{3}$/.test(rule_id))
   */
  uses_regex_id_check: boolean
  /**
   * True if any check uses keyword presence as a semantic proxy
   * (e.g. text.includes("because") to infer causal reasoning exists)
   */
  uses_keyword_proxy: boolean
}

// ---------------------------------------------------------------------------
// P1: STRUCTURE_OVER_SURFACE — gate analysis
// ---------------------------------------------------------------------------

/**
 * Check whether a gate implementation respects STRUCTURE_OVER_SURFACE.
 *
 * A gate passes if:
 *   - It has an RPP-based check path (has_rpp_check = true), AND
 *   - Any surface pattern usage is confined to a fallback block (surface_is_fallback_only = true)
 *
 * A gate fails (error) if:
 *   - It uses surface patterns on llm_output when RPP is available
 *   - i.e. has_surface_pattern = true AND surface_is_fallback_only = false AND has_rpp_check = true
 *
 * A gate warns if:
 *   - It has no RPP check path at all (has_rpp_check = false)
 */
export function checkGateStructureOverSurface(
  gate: GateAnalysisInput
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  if (!gate.has_rpp_check) {
    failures.push({
      code: InvariantCodes.GATE_MISSING_RPP_CHECK,
      severity: "warning",
      message: `gate "${gate.gate_id}" has no RPP-based check path. All checks operate on raw text. Add ctx.rpp path.`,
    })
  }

  if (gate.has_surface_pattern && !gate.surface_is_fallback_only) {
    failures.push({
      code: InvariantCodes.GATE_SURFACE_PATTERN_ON_RPP,
      severity: "error",
      message: `gate "${gate.gate_id}" uses surface pattern (regex/includes) on llm_output outside of a fallback block. This violates STRUCTURE_OVER_SURFACE.`,
    })
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

/**
 * Check all gates in a system against STRUCTURE_OVER_SURFACE.
 */
export function checkAllGatesStructureOverSurface(
  gates: GateAnalysisInput[]
): InvariantCheckResult {
  return mergeResults(gates.map(checkGateStructureOverSurface))
}

// ---------------------------------------------------------------------------
// P2: VERIFY_SEMANTICS_NOT_FORMAT — validator analysis
// ---------------------------------------------------------------------------

/**
 * Check whether a validator implementation respects VERIFY_SEMANTICS_NOT_FORMAT.
 *
 * A validator passes if:
 *   - It does NOT use length as a quality proxy (uses_length_proxy = false)
 *   - It does NOT use regex for ID validation (uses_regex_id_check = false)
 *   - It does NOT use keyword presence as semantic proxy (uses_keyword_proxy = false)
 */
export function checkValidatorSemanticsNotFormat(
  validator: ValidatorAnalysisInput
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  if (validator.uses_keyword_proxy) {
    failures.push({
      code: InvariantCodes.VALIDATOR_FORMAT_PROXY,
      severity: "error",
      message: `validator "${validator.validator_id}" uses keyword presence as a semantic proxy. ` +
        `Replace with structural check (e.g. check references array, not text containing "because").`,
    })
  }

  if (validator.uses_length_proxy) {
    failures.push({
      code: InvariantCodes.VALIDATOR_LENGTH_PROXY,
      severity: "warning",
      message: `validator "${validator.validator_id}" uses string/array length as a quality proxy. ` +
        `Length >= 1 does not guarantee semantic quality. Add content-level checks.`,
    })
  }

  if (validator.uses_regex_id_check) {
    failures.push({
      code: InvariantCodes.VALIDATOR_REGEX_ID_CHECK,
      severity: "warning",
      message: `validator "${validator.validator_id}" uses regex to validate an ID instead of registry lookup. ` +
        `Format-valid IDs may not be registered. Use a Set/Map registry.`,
    })
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

/**
 * Check all validators against VERIFY_SEMANTICS_NOT_FORMAT.
 */
export function checkAllValidatorsSemanticsNotFormat(
  validators: ValidatorAnalysisInput[]
): InvariantCheckResult {
  return mergeResults(validators.map(checkValidatorSemanticsNotFormat))
}

// ---------------------------------------------------------------------------
// Combined check
// ---------------------------------------------------------------------------

export function checkAllStructurePrinciples(
  gates: GateAnalysisInput[],
  validators: ValidatorAnalysisInput[]
): InvariantCheckResult {
  return mergeResults([
    checkAllGatesStructureOverSurface(gates),
    checkAllValidatorsSemanticsNotFormat(validators),
  ])
}
