/**
 * schema.ts — CognitionDeclaration type (p174)
 *
 * The standard LLM output protocol for cognitive declarations.
 * This is the input type consumed by all p174 validators.
 */

import type { PrincipalId } from "./taxonomy.js"

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

export type CognitionPhase =
  | "UNDERSTAND"
  | "OBSERVE"
  | "ANALYZE"
  | "DECIDE"
  | "DESIGN"
  | "PLAN"
  | "EXECUTE"
  | "VALIDATE"

export interface CognitionDeclaration {
  phase:           CognitionPhase
  type:            string          // CDP taxonomy type (debugging / reasoning / design / ...)
  subtype?:        string
  principals_used: PrincipalId[]
  evidence:        Evidence[]
  claims:          Claim[]
  attribution?:    Attribution
}
