/**
 * types.ts — CDP v1 Cognition shared types (p173)
 *
 * Shared types used across the cognition module:
 *   - FailureAttribution: single attributed failure with phase/principal/confidence
 *   - AttributionRule: rule mapping an error code to a phase + principal hypothesis
 *   - FailureTrace: complete failure record for a single run
 */

import type { ValidationError } from "./validator-pipeline.js"

// ── FailureAttribution ────────────────────────────────────────────────────────

export interface FailureAttribution {
  errorCode:          string
  phase?:             string
  type?:              string
  subType?:           string
  principal?:         string
  confidence:         "high" | "medium" | "low"
  reason:             string
}

// ── AttributionRule ───────────────────────────────────────────────────────────

export interface AttributionRule {
  errorCode:          string
  validator?:         string
  appliesToTypes?:    string[]
  attributedPhase:    string
  attributedPrincipal?: string
  confidence:         "high" | "medium" | "low"
  reasonTemplate:     string
}

// ── FailureTrace ──────────────────────────────────────────────────────────────

export interface FailureTrace {
  taskId:             string
  runId:              string
  declaration: {
    phase?:           string
    type:             string
    subType?:         string
    principals:       string[]
  }
  validatorsRun:      string[]
  errors:             ValidationError[]
  attributions:       FailureAttribution[]
  primaryAttribution?: FailureAttribution
  timestamp:          string
}
