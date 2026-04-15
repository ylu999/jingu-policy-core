/**
 * schema.ts — CognitionDeclaration type (p174)
 *
 * The standard LLM output protocol for cognitive declarations.
 * This is the input type consumed by all p174 validators.
 */

import type { Phase } from "jingu-protocol"
import type { PrincipalId } from "./taxonomy.js"

/**
 * Backward-compat alias — consumers that import CognitionPhase
 * from this module continue to work. The canonical type is Phase
 * from jingu-protocol.
 */
export type CognitionPhase = Phase

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface Evidence {
  type:    "code" | "runtime" | "test" | "doc"
  content: string
}

// ── Claim ─────────────────────────────────────────────────────────────────────

export interface Claim {
  statement:    string
  supported_by: number[]  // indices into evidence[]
}

// ── Attribution ───────────────────────────────────────────────────────────────

export interface Attribution {
  target:     string
  confidence: number  // 0.0–1.0
}

// ── CognitionDeclaration ──────────────────────────────────────────────────────

export interface CognitionDeclaration {
  phase:           Phase
  type:            string          // CDP taxonomy type (debugging / reasoning / design / ...)
  subtype?:        string
  principals_used: PrincipalId[]
  evidence:        Evidence[]
  claims:          Claim[]
  attribution?:    Attribution
}
