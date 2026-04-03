import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import {
  TYPE_POLICIES,
  ALL_TYPES,
  ALL_PRINCIPALS,
  isValidPrincipal,
  isValidSubType,
  getTypePolicy,
  getTypeValidators,
} from "./taxonomy.js"

describe("taxonomy — structural invariants", () => {
  it("has exactly 9 types", () => {
    assert.strictEqual(ALL_TYPES.length, 9)
    assert.deepStrictEqual(ALL_TYPES.slice().sort(), [
      "analysis", "decision", "design", "diagnosis",
      "execution", "observation", "planning", "understanding", "validation",
    ])
  })

  it("has exactly 12 principal atoms", () => {
    assert.strictEqual(ALL_PRINCIPALS.length, 12)
  })

  it("each type has at least one subType", () => {
    for (const [type, policy] of Object.entries(TYPE_POLICIES)) {
      assert.ok(policy.subTypes.length > 0, `${type} must have ≥1 subType`)
    }
  })

  it("each type has at least one requiredPrincipal", () => {
    for (const [type, policy] of Object.entries(TYPE_POLICIES)) {
      assert.ok(policy.requiredPrincipals.length > 0, `${type} must have ≥1 requiredPrincipal`)
    }
  })

  it("each requiredPrincipal is a valid Principal atom", () => {
    for (const [type, policy] of Object.entries(TYPE_POLICIES)) {
      for (const p of policy.requiredPrincipals) {
        assert.ok(isValidPrincipal(p), `${type}.requiredPrincipals: "${p}" is not a valid Principal`)
      }
    }
  })

  it("no forbidden principal appears in required list", () => {
    for (const [type, policy] of Object.entries(TYPE_POLICIES)) {
      const forbidden = new Set(policy.forbiddenPrincipals ?? [])
      for (const p of policy.requiredPrincipals) {
        assert.ok(!forbidden.has(p), `${type}: "${p}" is both required and forbidden`)
      }
    }
  })

  it("no forbidden principal appears in optional list", () => {
    for (const [type, policy] of Object.entries(TYPE_POLICIES)) {
      const forbidden = new Set(policy.forbiddenPrincipals ?? [])
      for (const p of policy.optionalPrincipals ?? []) {
        assert.ok(!forbidden.has(p), `${type}: "${p}" is both optional and forbidden`)
      }
    }
  })

  it("each type has at least one typeValidator", () => {
    for (const [type, policy] of Object.entries(TYPE_POLICIES)) {
      assert.ok(policy.typeValidators.length > 0, `${type} must have ≥1 typeValidator`)
    }
  })

  it("policy.type matches its key in TYPE_POLICIES", () => {
    for (const [key, policy] of Object.entries(TYPE_POLICIES)) {
      assert.strictEqual(policy.type, key)
    }
  })
})

describe("lookup helpers", () => {
  it("getTypePolicy returns correct policy for execution", () => {
    const p = getTypePolicy("execution")
    assert.ok(p !== undefined)
    assert.strictEqual(p.type, "execution")
    assert.ok(p.requiredPrincipals.includes("scope_control"))
    assert.ok(p.requiredPrincipals.includes("minimal_change"))
  })

  it("getTypePolicy returns undefined for unknown type", () => {
    assert.strictEqual(getTypePolicy("nonexistent"), undefined)
  })

  it("isValidPrincipal accepts known principals", () => {
    assert.strictEqual(isValidPrincipal("evidence_based"), true)
    assert.strictEqual(isValidPrincipal("minimal_change"), true)
    assert.strictEqual(isValidPrincipal("risk_awareness"), true)
  })

  it("isValidPrincipal rejects unknown strings", () => {
    assert.strictEqual(isValidPrincipal("workaround_only"), false)
    assert.strictEqual(isValidPrincipal("fix_cause_not_symptom"), false)
    assert.strictEqual(isValidPrincipal(""), false)
  })

  it("isValidSubType works correctly", () => {
    assert.strictEqual(isValidSubType("execution", "code_change"), true)
    assert.strictEqual(isValidSubType("execution", "log_reading"), false)
    assert.strictEqual(isValidSubType("observation", "log_reading"), true)
    assert.strictEqual(isValidSubType("nonexistent", "anything"), false)
  })

  it("getTypeValidators returns correct validators for execution", () => {
    const v = getTypeValidators("execution")
    assert.ok(v.includes("scope_check"))
    assert.ok(v.includes("execution_check"))
    assert.ok(v.includes("diff_size_check"))
  })

  it("getTypeValidators returns correct validators for diagnosis", () => {
    const v = getTypeValidators("diagnosis")
    assert.ok(v.includes("evidence_coverage"))
    assert.ok(v.includes("no_unsupported_claim"))
    assert.ok(v.includes("causal_link_check"))
  })

  it("getTypeValidators returns [] for unknown type", () => {
    assert.deepStrictEqual(getTypeValidators("nonexistent"), [])
  })
})

describe("specific type contracts", () => {
  it("execution forbids hypothesis_testing and causality", () => {
    const p = getTypePolicy("execution")!
    assert.ok(p.forbiddenPrincipals?.includes("hypothesis_testing"))
    assert.ok(p.forbiddenPrincipals?.includes("causality"))
  })

  it("observation requires evidence_based and no_hallucination", () => {
    const p = getTypePolicy("observation")!
    assert.ok(p.requiredPrincipals.includes("evidence_based"))
    assert.ok(p.requiredPrincipals.includes("no_hallucination"))
  })

  it("diagnosis requires both evidence_based and causality", () => {
    const p = getTypePolicy("diagnosis")!
    assert.ok(p.requiredPrincipals.includes("evidence_based"))
    assert.ok(p.requiredPrincipals.includes("causality"))
  })

  it("planning requires completeness and consistency_check", () => {
    const p = getTypePolicy("planning")!
    assert.ok(p.requiredPrincipals.includes("completeness"))
    assert.ok(p.requiredPrincipals.includes("consistency_check"))
  })
})
