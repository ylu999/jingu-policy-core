export type InvariantSeverity = "error" | "warning"

export const InvariantCodes = {
  // transition
  MISSING_VERIFY:                    "MISSING_VERIFY",
  INVALID_VERIFY_SPEC:               "INVALID_VERIFY_SPEC",
  VERIFY_NOT_EVIDENCE_BASED:         "VERIFY_NOT_EVIDENCE_BASED",
  TRANSITION_WITHOUT_PASSING_VERIFY: "TRANSITION_WITHOUT_PASSING_VERIFY",
  STATE_CHANGED_WITHOUT_TRANSITION:  "STATE_CHANGED_WITHOUT_TRANSITION",
  // execution
  NO_OBSERVABLE_OUTPUT:              "NO_OBSERVABLE_OUTPUT",
  NO_OP_FORBIDDEN:                   "NO_OP_FORBIDDEN",
  SCOPE_VIOLATION:                   "SCOPE_VIOLATION",
  NON_TYPED_FAILURE:                 "NON_TYPED_FAILURE",
  // replay
  NON_REPLAYABLE_EXECUTION:          "NON_REPLAYABLE_EXECUTION",
  MISSING_DECISION_LOG:              "MISSING_DECISION_LOG",
  // event log
  INVALID_EVENT_SEQUENCE:            "INVALID_EVENT_SEQUENCE",
  MISSING_ATTEMPT_ID:                "MISSING_ATTEMPT_ID",
  MISSING_EVENT_STATUS:              "MISSING_EVENT_STATUS",
  // multi-agent
  CANDIDATE_WRITES_CANONICAL_STATE:  "CANDIDATE_WRITES_CANONICAL_STATE",
  MERGED_RESULT_NOT_REVERIFIED:      "MERGED_RESULT_NOT_REVERIFIED",
  // version
  STALE_STATE_VERSION:               "STALE_STATE_VERSION",
  // trace principles
  CAUSAL_ROOT_MISSING:                 "CAUSAL_ROOT_MISSING",
  CAUSAL_MULTIPLE_ROOTS:               "CAUSAL_MULTIPLE_ROOTS",
  CAUSAL_DANGLING_PARENT:              "CAUSAL_DANGLING_PARENT",
  CAUSAL_NULL_ROOT:                    "CAUSAL_NULL_ROOT",
  SEMANTIC_UNKNOWN_STATUS:             "SEMANTIC_UNKNOWN_STATUS",
  MEASUREMENT_NEGATIVE_DURATION:       "MEASUREMENT_NEGATIVE_DURATION",
  MEASUREMENT_NONZERO_ROOT:            "MEASUREMENT_NONZERO_ROOT",
  MEASUREMENT_NONMONOTONIC:            "MEASUREMENT_NONMONOTONIC",
  DETERMINISM_LENGTH_MISMATCH:         "DETERMINISM_LENGTH_MISMATCH",
  DETERMINISM_TYPE_MISMATCH:           "DETERMINISM_TYPE_MISMATCH",
  DETERMINISM_STATUS_MISMATCH:         "DETERMINISM_STATUS_MISMATCH",
  DETERMINISM_PARENT_MISMATCH:         "DETERMINISM_PARENT_MISMATCH",
  DETERMINISM_GROUPING_MISMATCH:       "DETERMINISM_GROUPING_MISMATCH",
  RECONSTRUCTABILITY_EMPTY_PAYLOAD:    "RECONSTRUCTABILITY_EMPTY_PAYLOAD",
  RECONSTRUCTABILITY_VERDICT_NOT_LAST: "RECONSTRUCTABILITY_VERDICT_NOT_LAST",
  // structure-over-surface principles
  GATE_SURFACE_PATTERN_ON_RPP:    "GATE_SURFACE_PATTERN_ON_RPP",
  GATE_MISSING_RPP_CHECK:         "GATE_MISSING_RPP_CHECK",
  VALIDATOR_FORMAT_PROXY:         "VALIDATOR_FORMAT_PROXY",
  VALIDATOR_LENGTH_PROXY:         "VALIDATOR_LENGTH_PROXY",
  VALIDATOR_REGEX_ID_CHECK:       "VALIDATOR_REGEX_ID_CHECK",
  // system model derivation principles (SM1-SM5) + evaluation alignment (EA1-EA8)
  SYSTEM_MODEL_NOT_DERIVED:         "SYSTEM_MODEL_NOT_DERIVED",   // SM1: system touched before model confirmed
  EVAL_MISSING_FAILURE_LAYER:       "EVAL_MISSING_FAILURE_LAYER",
  EVAL_FALLBACK_UNLABELED:          "EVAL_FALLBACK_UNLABELED",
  EVAL_FALLBACK_PROMOTED:           "EVAL_FALLBACK_PROMOTED",
  EVAL_METHOD_UNDECLARED:           "EVAL_METHOD_UNDECLARED",
  EVAL_QUALITY_WITHOUT_OBSERVATION: "EVAL_QUALITY_WITHOUT_OBSERVATION",
  // runtime truth principles (RT1–RT8)
  RT_IDENTITY_NOT_VERIFIED:              "RT_IDENTITY_NOT_VERIFIED",              // RT1: behavior analyzed without verifying image digest + commit
  RT_UNTYPED_ABSENCE:                    "RT_UNTYPED_ABSENCE",                    // RT2: signal absence attributed to unclassified cause
  RT_MODEL_BLAMED_BEFORE_WIRING_CLEARED: "RT_MODEL_BLAMED_BEFORE_WIRING_CLEARED", // RT3: model blamed without ruling out deployment/wiring
  RT_MISSING_ACTIVATION_PROOF:           "RT_MISSING_ACTIVATION_PROOF",           // RT4: control-plane feature has no activation proof in logs
  RT_BATCH_WITHOUT_SMOKE_TEST:           "RT_BATCH_WITHOUT_SMOKE_TEST",           // RT5: multi-instance batch launched without smoke test
  RT_ARTIFACT_MISSING_PROVENANCE:        "RT_ARTIFACT_MISSING_PROVENANCE",        // RT6: run artifact missing image_digest/git_commit/build_timestamp
  // single source of truth principles (SST1–SST3)
  SST_DUPLICATE_DEFINITION:       "SST_DUPLICATE_DEFINITION",       // SST1: controlled vocabulary defined in more than one authoritative location
  SST_CONSUMER_REDECLARES:        "SST_CONSUMER_REDECLARES",        // SST2: consumer hardcodes a value instead of calling accessor
  SST_STALE_FALLBACK:             "SST_STALE_FALLBACK",             // SST2: except/fallback block returns a copy of the definition instead of ""
  SST_NO_AUTHORITATIVE_SOURCE:    "SST_NO_AUTHORITATIVE_SOURCE",    // SST1: vocabulary used in multiple places with no single owner file
  // cognition consistency principles (CC1–CC5)
  CC_SUBTYPE_UNKNOWN:             "CC_SUBTYPE_UNKNOWN",             // CC1+CC4: phase_record.subtype="unknown" — phase name not canonical or not in map
  CC_FAKE_CHECK_ON_UNEVALUATED:   "CC_FAKE_CHECK_ON_UNEVALUATED",   // CC2: principal flagged fake when its inference rule didn't run (applies_to mismatch)
  CC_ORPHAN_CONTRACT:             "CC_ORPHAN_CONTRACT",             // CC3: required_principal has no matching inference rule and no lifecycle protection
  CC_INFERENCE_OPACITY:           "CC_INFERENCE_OPACITY",           // CC5: declared-but-not-inferred principal has no skip_reason logged
} as const

export type InvariantCode = typeof InvariantCodes[keyof typeof InvariantCodes]
