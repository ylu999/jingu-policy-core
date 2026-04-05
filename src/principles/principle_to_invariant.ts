/**
 * principle_to_invariant.ts — Maps jingu design principles (L1) to machine-checkable
 * invariants (L2) and their runtime enforcement locations (L3).
 *
 * This is the "compilation chain" from design intent to system behavior:
 *   Principle (human worldview)
 *     → Invariant (machine-checkable predicate)
 *       → Validator (function that checks the predicate)
 *         → Enforcement (where in the runtime this fires)
 *
 * Reference: ~/jingu/repo/jingu/.claude/jingu-principles.md
 */

export type PrincipleId =
  | "P1_CONTROL_AUTHORITY"
  | "P2_TYPED_CONTRACTS"
  | "P3_ADMIT_OR_REJECT"
  | "P4_PHASE_BOUNDARIES"
  | "P5_FAIL_FAST"
  | "P6_CONTROL_DATA_SEPARATION"
  | "P7_DECLARED_COGNITION"
  | "P8_IN_LOOP_GOVERNANCE";

export type InvariantId = string; // e.g. "INV-P1-01"

export interface Invariant {
  id: InvariantId;
  principle: PrincipleId;
  statement: string;
  /** Predicate in pseudocode — human readable, not executable */
  predicate: string;
  /** Where this invariant is enforced in L3 runtime */
  enforcement_location: string;
  /** Plan that implements the enforcement */
  plan_ref: string;
  /** Observable signal when invariant is satisfied */
  activation_proof: string;
}

export const INVARIANTS: Invariant[] = [
  // ── P1: Control Must Have Authority ────────────────────────────────────────
  {
    id: "INV-P1-01",
    principle: "P1_CONTROL_AUTHORITY",
    statement: "VerdictStop halts the attempt loop",
    predicate:
      "early_stop_verdict.type == STOP → attempt loop exits before next step",
    enforcement_location:
      "run_with_jingu_gate.py — _monitored_step() early_stop_verdict check",
    plan_ref: "p186",
    activation_proof: "[cp] phase=... verdict=stop",
  },
  {
    id: "INV-P1-02",
    principle: "P1_CONTROL_AUTHORITY",
    statement: "VerdictRedirect injects hint into next step context",
    predicate:
      "pending_redirect_hint != '' → next step user message prefixed with hint",
    enforcement_location:
      "run_with_jingu_gate.py — pending_redirect_hint injection in step loop",
    plan_ref: "p186",
    activation_proof: "[cp] phase=... verdict=redirect hint=...",
  },

  // ── P2: Typed Contracts Over Prompts ───────────────────────────────────────
  {
    id: "INV-P2-01",
    principle: "P2_TYPED_CONTRACTS",
    statement:
      "ANALYZE phase exit requires causal_grounding principal declaration",
    predicate:
      "phase_record.phase == ANALYZE AND 'causal_grounding' NOT IN phase_record.principals → violation",
    enforcement_location:
      "run_with_jingu_gate.py — VerdictAdvance block → principal_gate.check_principal_gate()",
    plan_ref: "p188",
    activation_proof: "[principal_gate] phase=ANALYZE violation=none|missing_causal_grounding",
  },
  {
    id: "INV-P2-02",
    principle: "P2_TYPED_CONTRACTS",
    statement: "EXECUTE phase exit requires minimal_change principal declaration",
    predicate:
      "phase_record.phase == EXECUTE AND 'minimal_change' NOT IN phase_record.principals → violation",
    enforcement_location:
      "run_with_jingu_gate.py — VerdictAdvance block → principal_gate.check_principal_gate()",
    plan_ref: "p188",
    activation_proof: "[principal_gate] phase=EXECUTE violation=none|missing_minimal_change",
  },
  {
    id: "INV-P2-03",
    principle: "P2_TYPED_CONTRACTS",
    statement:
      "JUDGE phase exit requires invariant_preservation principal declaration",
    predicate:
      "phase_record.phase == JUDGE AND 'invariant_preservation' NOT IN phase_record.principals → violation",
    enforcement_location:
      "run_with_jingu_gate.py — VerdictAdvance block → principal_gate.check_principal_gate()",
    plan_ref: "p188",
    activation_proof:
      "[principal_gate] phase=JUDGE violation=none|missing_invariant_preservation",
  },

  // ── P3: Admit or Reject ────────────────────────────────────────────────────
  {
    id: "INV-P3-01",
    principle: "P3_ADMIT_OR_REJECT",
    statement: "controlled_verify is skipped when prerequisite gate fails",
    predicate:
      "_prereq_pass == False → controlled_verify not called, verify_skipped=True in jingu_body",
    enforcement_location:
      "run_with_jingu_gate.py — _verify_prerequisites() gate before controlled_verify",
    plan_ref: "p192",
    activation_proof:
      "[verify_gate] prerequisite=fail(...) controlled_verify=skipped",
  },
  {
    id: "INV-P3-02",
    principle: "P3_ADMIT_OR_REJECT",
    statement:
      "verify_skipped is distinct from verify_fail in attempt results",
    predicate:
      "jingu_body['controlled_verify_result'] in {'pass', 'fail', 'skipped'} — three distinct values",
    enforcement_location: "run_with_jingu_gate.py — jingu_body fields at attempt end",
    plan_ref: "p192",
    activation_proof: "verify_skipped=True OR controlled_verify_result=skipped in jingu_body",
  },

  // ── P4: Phase Boundaries Must Be Strict ───────────────────────────────────
  {
    id: "INV-P4-01",
    principle: "P4_PHASE_BOUNDARIES",
    statement: "Each step receives phase-aware context before agent reasoning",
    predicate:
      "every agent step user message prefixed with phase guidance from PHASE_GUIDANCE[current_phase]",
    enforcement_location:
      "run_with_jingu_gate.py — phase_prompt.build_phase_prefix() injected per step",
    plan_ref: "p189",
    activation_proof: "[phase_injection] phase=... step=...",
  },
  {
    id: "INV-P4-02",
    principle: "P4_PHASE_BOUNDARIES",
    statement: "Every phase ADVANCE produces a structured PhaseRecord",
    predicate:
      "verdict.type == ADVANCE → extract_phase_record() called → phase_records list updated",
    enforcement_location: "run_with_jingu_gate.py — VerdictAdvance block",
    plan_ref: "p190",
    activation_proof: "[phase_record] phase=... principals=... evidence_refs=...",
  },

  // ── P5: Fail Fast ──────────────────────────────────────────────────────────
  {
    id: "INV-P5-01",
    principle: "P5_FAIL_FAST",
    statement: "In-loop judge fires before controlled_verify",
    predicate:
      "run_in_loop_judge() called at attempt end BEFORE controlled_verify() — not after",
    enforcement_location:
      "run_with_jingu_gate.py — in-loop judge block precedes controlled_verify call",
    plan_ref: "p191",
    activation_proof: "[in_loop_judge] patch_non_empty=... patch_format=... no_semantic_weakening=...",
  },
  {
    id: "INV-P5-02",
    principle: "P5_FAIL_FAST",
    statement: "Cognition gate fires at JUDGE phase entry, before verify",
    predicate:
      "check_cognition_at_judge() called when phase == JUDGE, before controlled_verify",
    enforcement_location: "run_with_jingu_gate.py — cognition gate block at JUDGE entry",
    plan_ref: "p187",
    activation_proof: "[cognition_gate] phase=JUDGE result=pass|fail",
  },

  // ── P6: Control/Data Separation ───────────────────────────────────────────
  {
    id: "INV-P6-01",
    principle: "P6_CONTROL_DATA_SEPARATION",
    statement:
      "Control state (verdicts, hints) lives in StepMonitorState, not in agent messages",
    predicate:
      "early_stop_verdict and pending_redirect_hint are fields of StepMonitorState — not parsed from LLM output",
    enforcement_location:
      "run_with_jingu_gate.py — StepMonitorState dataclass (cp_state, early_stop_verdict, pending_redirect_hint, phase_records)",
    plan_ref: "p186",
    activation_proof: "[init] verdict_routing_enabled=True",
  },

  // ── P7: Declared Cognition ─────────────────────────────────────────────────
  {
    id: "INV-P7-01",
    principle: "P7_DECLARED_COGNITION",
    statement: "Cognition check validates reasoning before JUDGE phase proceeds",
    predicate:
      "at JUDGE phase entry: check_cognition_at_judge() returns pass → controlled_verify allowed",
    enforcement_location: "run_with_jingu_gate.py — cognition gate at JUDGE",
    plan_ref: "p187",
    activation_proof: "[cognition_gate] result=pass|fail",
  },

  // ── P8: In-Loop Governance ─────────────────────────────────────────────────
  {
    id: "INV-P8-01",
    principle: "P8_IN_LOOP_GOVERNANCE",
    statement: "All 6 gate activation proofs appear in every run's init log",
    predicate:
      "traj contains: verdict_routing_enabled=True, cognition_gate_enabled=True, phase_injection_enabled=True, in_loop_judge_enabled=True, principal_gate_enabled=True, verify_gate_enabled=True",
    enforcement_location: "run_with_jingu_gate.py — print_activation_proof()",
    plan_ref: "p186–p192",
    activation_proof: "[init] <feature>=True (6 lines total)",
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Get all invariants for a given principle */
export function getInvariantsForPrinciple(principle: PrincipleId): Invariant[] {
  return INVARIANTS.filter((inv) => inv.principle === principle);
}

/** Get invariant by ID */
export function getInvariant(id: InvariantId): Invariant | undefined {
  return INVARIANTS.find((inv) => inv.id === id);
}

/** List all activation proofs expected in a well-formed run */
export function getExpectedActivationProofs(): string[] {
  return INVARIANTS.filter((inv) => inv.activation_proof).map(
    (inv) => inv.activation_proof,
  );
}

/** Summary table — principle → invariant count */
export function getPrincipleInvariantSummary(): Record<PrincipleId, number> {
  const summary = {} as Record<PrincipleId, number>;
  for (const inv of INVARIANTS) {
    summary[inv.principle] = (summary[inv.principle] || 0) + 1;
  }
  return summary;
}
