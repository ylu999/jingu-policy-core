import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  checkGateStructureOverSurface,
  checkAllGatesStructureOverSurface,
  checkValidatorSemanticsNotFormat,
  checkAllStructurePrinciples,
  type GateAnalysisInput,
  type ValidatorAnalysisInput,
} from "../../src/principles/structure-over-surface.js"

describe("structure-over-surface principles", () => {

  // -------------------------------------------------------------------------
  // P1: STRUCTURE_OVER_SURFACE — gate checks
  // -------------------------------------------------------------------------

  describe("checkGateStructureOverSurface", () => {
    it("pass: gate has RPP check and no surface pattern", () => {
      const gate: GateAnalysisInput = {
        gate_id: "rpp_tradeoff_gate",
        has_rpp_check: true,
        has_surface_pattern: false,
        surface_is_fallback_only: false,
      }
      const result = checkGateStructureOverSurface(gate)
      assert.equal(result.ok, true)
    })

    it("pass: gate has RPP check and surface pattern is fallback only", () => {
      const gate: GateAnalysisInput = {
        gate_id: "rpp_tradeoff_gate_with_fallback",
        has_rpp_check: true,
        has_surface_pattern: true,
        surface_is_fallback_only: true,
      }
      const result = checkGateStructureOverSurface(gate)
      assert.equal(result.ok, true)
    })

    it("error: gate has RPP check but surface pattern is NOT fallback only", () => {
      const gate: GateAnalysisInput = {
        gate_id: "multi_option_gate",
        has_rpp_check: true,
        has_surface_pattern: true,
        surface_is_fallback_only: false,
      }
      const result = checkGateStructureOverSurface(gate)
      assert.equal(result.ok, false)
      assert.ok(result.failures.some(f => f.code === "GATE_SURFACE_PATTERN_ON_RPP"))
      assert.ok(result.failures.some(f => f.severity === "error"))
    })

    it("warning: gate has no RPP check at all", () => {
      const gate: GateAnalysisInput = {
        gate_id: "evidence_required_gate",
        has_rpp_check: false,
        has_surface_pattern: true,
        surface_is_fallback_only: false,
      }
      const result = checkGateStructureOverSurface(gate)
      assert.equal(result.ok, false)
      assert.ok(result.failures.some(f => f.code === "GATE_MISSING_RPP_CHECK"))
      assert.ok(result.failures.some(f => f.severity === "warning"))
    })

    it("warning only (not error): gate has no RPP check and no surface pattern", () => {
      const gate: GateAnalysisInput = {
        gate_id: "unknown_gate",
        has_rpp_check: false,
        has_surface_pattern: false,
        surface_is_fallback_only: false,
      }
      const result = checkGateStructureOverSurface(gate)
      assert.equal(result.ok, false)
      const errors = result.failures.filter(f => f.severity === "error")
      assert.equal(errors.length, 0, "no errors expected, only warnings")
    })
  })

  describe("checkAllGatesStructureOverSurface", () => {
    it("pass: all gates are RPP-first", () => {
      const gates: GateAnalysisInput[] = [
        { gate_id: "g1", has_rpp_check: true, has_surface_pattern: false, surface_is_fallback_only: false },
        { gate_id: "g2", has_rpp_check: true, has_surface_pattern: true, surface_is_fallback_only: true },
      ]
      const result = checkAllGatesStructureOverSurface(gates)
      assert.equal(result.ok, true)
    })

    it("fail: one gate violates STRUCTURE_OVER_SURFACE", () => {
      const gates: GateAnalysisInput[] = [
        { gate_id: "g1", has_rpp_check: true, has_surface_pattern: false, surface_is_fallback_only: false },
        { gate_id: "g2_bad", has_rpp_check: false, has_surface_pattern: true, surface_is_fallback_only: false },
      ]
      const result = checkAllGatesStructureOverSurface(gates)
      assert.equal(result.ok, false)
    })
  })

  // -------------------------------------------------------------------------
  // P2: VERIFY_SEMANTICS_NOT_FORMAT — validator checks
  // -------------------------------------------------------------------------

  describe("checkValidatorSemanticsNotFormat", () => {
    it("pass: validator has no proxies", () => {
      const v: ValidatorAnalysisInput = {
        validator_id: "rpp_evidence_gate",
        uses_length_proxy: false,
        uses_regex_id_check: false,
        uses_keyword_proxy: false,
      }
      const result = checkValidatorSemanticsNotFormat(v)
      assert.equal(result.ok, true)
    })

    it("error: validator uses keyword proxy", () => {
      const v: ValidatorAnalysisInput = {
        validator_id: "evidence_required_gate",
        uses_length_proxy: false,
        uses_regex_id_check: false,
        uses_keyword_proxy: true,
      }
      const result = checkValidatorSemanticsNotFormat(v)
      assert.equal(result.ok, false)
      assert.ok(result.failures.some(f => f.code === "VALIDATOR_FORMAT_PROXY"))
      assert.ok(result.failures.some(f => f.severity === "error"))
    })

    it("warning: validator uses length proxy", () => {
      const v: ValidatorAnalysisInput = {
        validator_id: "binding_validator",
        uses_length_proxy: true,
        uses_regex_id_check: false,
        uses_keyword_proxy: false,
      }
      const result = checkValidatorSemanticsNotFormat(v)
      assert.equal(result.ok, false)
      assert.ok(result.failures.some(f => f.code === "VALIDATOR_LENGTH_PROXY"))
      assert.ok(result.failures.some(f => f.severity === "warning"))
    })

    it("warning: validator uses regex for ID check", () => {
      const v: ValidatorAnalysisInput = {
        validator_id: "binding_validator_id",
        uses_length_proxy: false,
        uses_regex_id_check: true,
        uses_keyword_proxy: false,
      }
      const result = checkValidatorSemanticsNotFormat(v)
      assert.equal(result.ok, false)
      assert.ok(result.failures.some(f => f.code === "VALIDATOR_REGEX_ID_CHECK"))
    })

    it("multiple violations accumulate", () => {
      const v: ValidatorAnalysisInput = {
        validator_id: "legacy_gate",
        uses_length_proxy: true,
        uses_regex_id_check: true,
        uses_keyword_proxy: true,
      }
      const result = checkValidatorSemanticsNotFormat(v)
      assert.equal(result.failures.length, 3)
    })
  })

  // -------------------------------------------------------------------------
  // Combined
  // -------------------------------------------------------------------------

  describe("checkAllStructurePrinciples", () => {
    it("pass: all gates and validators comply", () => {
      const gates: GateAnalysisInput[] = [
        { gate_id: "g1", has_rpp_check: true, has_surface_pattern: false, surface_is_fallback_only: false },
      ]
      const validators: ValidatorAnalysisInput[] = [
        { validator_id: "v1", uses_length_proxy: false, uses_regex_id_check: false, uses_keyword_proxy: false },
      ]
      const result = checkAllStructurePrinciples(gates, validators)
      assert.equal(result.ok, true)
    })

    it("fail: mixed violations from both gates and validators", () => {
      const gates: GateAnalysisInput[] = [
        { gate_id: "bad_gate", has_rpp_check: false, has_surface_pattern: true, surface_is_fallback_only: false },
      ]
      const validators: ValidatorAnalysisInput[] = [
        { validator_id: "bad_validator", uses_length_proxy: false, uses_regex_id_check: false, uses_keyword_proxy: true },
      ]
      const result = checkAllStructurePrinciples(gates, validators)
      assert.equal(result.ok, false)
      assert.ok(result.failures.length >= 2)
    })
  })
})
