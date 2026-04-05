/**
 * Machine-checkable counterpart to .claude/rules/single-source-of-truth.md.
 *
 * Three principles:
 *   SST1. ONE_AUTHORITATIVE_DEFINITION — every controlled vocabulary item has exactly one owner file
 *   SST2. CONSUMERS_REFERENCE_NOT_REDECLARE — consumers call accessors, never copy values
 *   SST3. DRIFT_DETECTED_BY_CI — duplication is caught structurally, not by memory
 *
 * These checks operate on a REGISTRY of controlled vocabularies and their observed occurrences
 * across the codebase. The registry is built by a CI script (check:single-source).
 *
 * Origin: jingu-swebench principal name drift incident (2026-04-05).
 * Principal names were hardcoded in 5 files independently of subtype_contracts.py,
 * causing agent to declare v1 names (causality, evidence_based) instead of v2.0 names.
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
// Types
// ---------------------------------------------------------------------------

/**
 * A controlled vocabulary item — a string constant that should have exactly
 * one authoritative source and be derived by all other consumers.
 *
 * Examples: phase names, principal names, error codes, contract keys.
 */
export type VocabularyItem = {
  /** Human-readable name for the vocabulary set (e.g. "principal_names") */
  vocabulary_id: string
  /** The constant value itself (e.g. "causal_grounding") */
  value: string
  /** File path of the one authoritative source that is allowed to define this value */
  authoritative_source: string
  /**
   * All file paths where this value appears as a string literal.
   * Includes the authoritative source itself (expected).
   * Any extra entry is a SST1/SST2 violation.
   */
  occurrences: string[]
}

/**
 * A fallback block (except/catch) that returns a value instead of degrading to "".
 * Any non-empty non-unknown string returned from a fallback is a SST2 violation.
 */
export type FallbackAnalysisInput = {
  /** File + function identifier (e.g. "phase_prompt.py:_build_pg fallback") */
  location: string
  /** The value returned in the fallback block */
  fallback_value: string
  /** True if the fallback_value is empty string or "unknown" (acceptable degradation) */
  is_degradation: boolean
}

// ---------------------------------------------------------------------------
// SST1: ONE_AUTHORITATIVE_DEFINITION
// ---------------------------------------------------------------------------

/**
 * Check that a vocabulary item appears as a string literal only in its
 * authoritative source file. Any other file containing the literal is a violation.
 *
 * Exception: test files (*.test.ts, test_*.py) are excluded from the check
 * because they legitimately assert specific values.
 */
export function checkSingleDefinition(item: VocabularyItem): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  const unauthorized = item.occurrences.filter(
    (f) =>
      f !== item.authoritative_source &&
      !f.includes(".test.") &&
      !f.includes("test_") &&
      !f.includes("/tests/")
  )

  if (unauthorized.length > 0) {
    failures.push({
      code: InvariantCodes.SST_DUPLICATE_DEFINITION,
      severity: "error",
      message:
        `vocabulary "${item.vocabulary_id}" value "${item.value}" appears outside its ` +
        `authoritative source "${item.authoritative_source}" in: ${unauthorized.join(", ")}. ` +
        `These files must import the value via accessor instead of hardcoding it.`,
    })
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

/**
 * Check all items in a vocabulary registry.
 */
export function checkAllVocabularyItems(
  items: VocabularyItem[]
): InvariantCheckResult {
  return mergeResults(items.map(checkSingleDefinition))
}

// ---------------------------------------------------------------------------
// SST2: CONSUMERS_REFERENCE_NOT_REDECLARE
// ---------------------------------------------------------------------------

/**
 * Check that a fallback block degrades gracefully instead of returning
 * a hardcoded copy of the definition.
 *
 * Acceptable fallback values: "" (empty string), "unknown", undefined/null.
 * Any non-empty, non-unknown string is a violation — it means the fallback
 * contains a copy of the definition that will go stale.
 */
export function checkFallbackDegrades(
  input: FallbackAnalysisInput
): InvariantCheckResult {
  if (input.is_degradation) return pass()

  return fail({
    code: InvariantCodes.SST_STALE_FALLBACK,
    severity: "error",
    message:
      `fallback at "${input.location}" returns "${input.fallback_value}" instead of "" or "unknown". ` +
      `Fallbacks must degrade gracefully — returning a copy of the definition creates a stale duplicate ` +
      `that will diverge when the authoritative source changes.`,
  })
}

/**
 * Check all fallback blocks in a system.
 */
export function checkAllFallbacksDegrades(
  fallbacks: FallbackAnalysisInput[]
): InvariantCheckResult {
  return mergeResults(fallbacks.map(checkFallbackDegrades))
}

// ---------------------------------------------------------------------------
// SST1+SST2: Check that each vocabulary set has an identified owner
// ---------------------------------------------------------------------------

export type VocabularySetInput = {
  /** Human-readable name for the vocabulary set */
  vocabulary_id: string
  /** File path of the authoritative source, or null if not identified */
  authoritative_source: string | null
  /** Number of files containing any item from this vocabulary */
  file_count: number
}

/**
 * Check that a vocabulary used across multiple files has an identified owner.
 * If file_count > 1 and no authoritative_source is declared, that is SST1 violation.
 */
export function checkVocabularyHasOwner(
  vocab: VocabularySetInput
): InvariantCheckResult {
  if (vocab.file_count <= 1) return pass()
  if (vocab.authoritative_source !== null) return pass()

  return fail({
    code: InvariantCodes.SST_NO_AUTHORITATIVE_SOURCE,
    severity: "error",
    message:
      `vocabulary "${vocab.vocabulary_id}" appears in ${vocab.file_count} files ` +
      `but has no declared authoritative source. ` +
      `Designate one file as the owner; all others must derive from it via accessor.`,
  })
}

// ---------------------------------------------------------------------------
// Combined check
// ---------------------------------------------------------------------------

export function checkAllSingleSourcePrinciples(
  items: VocabularyItem[],
  fallbacks: FallbackAnalysisInput[],
  vocabSets: VocabularySetInput[]
): InvariantCheckResult {
  return mergeResults([
    checkAllVocabularyItems(items),
    checkAllFallbacksDegrades(fallbacks),
    ...vocabSets.map(checkVocabularyHasOwner),
  ])
}
