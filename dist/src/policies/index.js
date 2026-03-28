"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allPolicies = exports.seniorPolicies = exports.disciplinePolicies = exports.p16ExternalizeContext = exports.p15FutureIntegrity = exports.p14MinimalIntervention = exports.p13Tradeoff = exports.p12SymptomRootCause = exports.p11LayerDiagnosis = exports.p10CoreTension = exports.p9HypothesisSearch = exports.p8ClaimHonesty = exports.p7Hygiene = exports.p6BoundedExecution = exports.p5RespectAuthority = exports.p4GlobalInvariants = exports.p3FailureClassification = exports.p2Preconditions = exports.p1ConstraintObedience = exports.P16 = exports.P15 = exports.P14 = exports.P13 = exports.P12 = exports.P11 = exports.P10 = exports.P9 = exports.P8 = exports.P7 = exports.P6 = exports.P5 = exports.P4 = exports.P3 = exports.P2 = exports.P1 = void 0;
const p1_constraint_obedience_1 = require("./discipline/p1-constraint-obedience");
Object.defineProperty(exports, "p1ConstraintObedience", { enumerable: true, get: function () { return p1_constraint_obedience_1.p1ConstraintObedience; } });
const p2_preconditions_1 = require("./discipline/p2-preconditions");
Object.defineProperty(exports, "p2Preconditions", { enumerable: true, get: function () { return p2_preconditions_1.p2Preconditions; } });
const p3_failure_classification_1 = require("./discipline/p3-failure-classification");
Object.defineProperty(exports, "p3FailureClassification", { enumerable: true, get: function () { return p3_failure_classification_1.p3FailureClassification; } });
const p4_global_invariants_1 = require("./discipline/p4-global-invariants");
Object.defineProperty(exports, "p4GlobalInvariants", { enumerable: true, get: function () { return p4_global_invariants_1.p4GlobalInvariants; } });
const p5_respect_authority_1 = require("./discipline/p5-respect-authority");
Object.defineProperty(exports, "p5RespectAuthority", { enumerable: true, get: function () { return p5_respect_authority_1.p5RespectAuthority; } });
const p6_bounded_execution_1 = require("./discipline/p6-bounded-execution");
Object.defineProperty(exports, "p6BoundedExecution", { enumerable: true, get: function () { return p6_bounded_execution_1.p6BoundedExecution; } });
const p7_hygiene_1 = require("./discipline/p7-hygiene");
Object.defineProperty(exports, "p7Hygiene", { enumerable: true, get: function () { return p7_hygiene_1.p7Hygiene; } });
const p8_claim_honesty_1 = require("./discipline/p8-claim-honesty");
Object.defineProperty(exports, "p8ClaimHonesty", { enumerable: true, get: function () { return p8_claim_honesty_1.p8ClaimHonesty; } });
const p9_hypothesis_search_1 = require("./discipline/p9-hypothesis-search");
Object.defineProperty(exports, "p9HypothesisSearch", { enumerable: true, get: function () { return p9_hypothesis_search_1.p9HypothesisSearch; } });
const p10_core_tension_1 = require("./senior/p10-core-tension");
Object.defineProperty(exports, "p10CoreTension", { enumerable: true, get: function () { return p10_core_tension_1.p10CoreTension; } });
const p11_layer_diagnosis_1 = require("./senior/p11-layer-diagnosis");
Object.defineProperty(exports, "p11LayerDiagnosis", { enumerable: true, get: function () { return p11_layer_diagnosis_1.p11LayerDiagnosis; } });
const p12_symptom_root_cause_1 = require("./senior/p12-symptom-root-cause");
Object.defineProperty(exports, "p12SymptomRootCause", { enumerable: true, get: function () { return p12_symptom_root_cause_1.p12SymptomRootCause; } });
const p13_tradeoff_1 = require("./senior/p13-tradeoff");
Object.defineProperty(exports, "p13Tradeoff", { enumerable: true, get: function () { return p13_tradeoff_1.p13Tradeoff; } });
const p14_minimal_intervention_1 = require("./senior/p14-minimal-intervention");
Object.defineProperty(exports, "p14MinimalIntervention", { enumerable: true, get: function () { return p14_minimal_intervention_1.p14MinimalIntervention; } });
const p15_future_integrity_1 = require("./senior/p15-future-integrity");
Object.defineProperty(exports, "p15FutureIntegrity", { enumerable: true, get: function () { return p15_future_integrity_1.p15FutureIntegrity; } });
const p16_externalize_context_1 = require("./senior/p16-externalize-context");
Object.defineProperty(exports, "p16ExternalizeContext", { enumerable: true, get: function () { return p16_externalize_context_1.p16ExternalizeContext; } });
// Named policy exports (P1–P15)
exports.P1 = p1_constraint_obedience_1.p1ConstraintObedience;
exports.P2 = p2_preconditions_1.p2Preconditions;
exports.P3 = p3_failure_classification_1.p3FailureClassification;
exports.P4 = p4_global_invariants_1.p4GlobalInvariants;
exports.P5 = p5_respect_authority_1.p5RespectAuthority;
exports.P6 = p6_bounded_execution_1.p6BoundedExecution;
exports.P7 = p7_hygiene_1.p7Hygiene;
exports.P8 = p8_claim_honesty_1.p8ClaimHonesty;
exports.P9 = p9_hypothesis_search_1.p9HypothesisSearch;
exports.P10 = p10_core_tension_1.p10CoreTension;
exports.P11 = p11_layer_diagnosis_1.p11LayerDiagnosis;
exports.P12 = p12_symptom_root_cause_1.p12SymptomRootCause;
exports.P13 = p13_tradeoff_1.p13Tradeoff;
exports.P14 = p14_minimal_intervention_1.p14MinimalIntervention;
exports.P15 = p15_future_integrity_1.p15FutureIntegrity;
exports.P16 = p16_externalize_context_1.p16ExternalizeContext;
// Discipline policies (P1-P9)
exports.disciplinePolicies = [
    exports.P1, exports.P2, exports.P3, exports.P4, exports.P5, exports.P6, exports.P7, exports.P8, exports.P9,
];
// Senior engineering policies (P10-P16)
exports.seniorPolicies = [
    exports.P10, exports.P11, exports.P12, exports.P13, exports.P14, exports.P15, exports.P16,
];
// All policies combined
exports.allPolicies = [
    ...exports.disciplinePolicies,
    ...exports.seniorPolicies,
];
