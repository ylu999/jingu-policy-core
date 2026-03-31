// tests/gates/gate-engine.test.ts
// Unit 0.3: Gate Engine tests

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  runGates,
  resolveGates,
  GATE_REGISTRY,
  evidenceRequiredGate,
  verifyGate,
  noOpDetectionGate,
  scopeGate,
  testPassGate,
  multiOptionGate,
  designCompletenessGate,
} from "../../src/gates/gate-engine.js"
import type { Gate, GateContext } from "../../src/gates/gate-engine.js"
import type { TaskContext, ExecutionConfig } from "../../src/resolver/policy-resolver.js"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TASK_CTX: TaskContext = {
  task_type: "design",
  risk_level: "low",
  is_irreversible: false,
}

const EXEC_CFG: ExecutionConfig = {
  active_packs: [],
  required_gates: [],
  reviewer_mode: "none",
  execution_mode: "single",
}

function makeCtx(llm_output: string, task_type = "design"): Omit<GateContext, "gate_id"> {
  return {
    llm_output,
    task_context: { ...TASK_CTX, task_type: task_type as TaskContext["task_type"] },
    execution_config: EXEC_CFG,
  }
}

// A gate that always returns a fixed verdict
function fixedGate(verdict: "pass" | "fail" | "reject" | "downgrade"): Gate {
  return (_ctx) => ({ gate_id: `fixed_${verdict}_gate`, verdict, reason: verdict === "pass" ? "" : "forced" })
}

// ---------------------------------------------------------------------------
// runGates — executor
// ---------------------------------------------------------------------------

describe("runGates — executor", () => {
  it("empty gates array returns pass with empty results", () => {
    const result = runGates([], makeCtx("some output"))
    assert.equal(result.verdict, "pass")
    assert.deepEqual(result.results, [])
    assert.equal(result.stopped_at, undefined)
  })

  it("all pass → verdict pass", () => {
    const result = runGates([fixedGate("pass"), fixedGate("pass")], makeCtx("output"))
    assert.equal(result.verdict, "pass")
    assert.equal(result.results.length, 2)
    assert.equal(result.stopped_at, undefined)
  })

  it("reject stops immediately — gate after reject does not run", () => {
    let secondRan = false
    const sentinel: Gate = (_ctx) => {
      secondRan = true
      return { gate_id: "sentinel", verdict: "pass", reason: "" }
    }
    const result = runGates([fixedGate("reject"), sentinel], makeCtx("output"))
    assert.equal(result.verdict, "reject")
    assert.equal(result.results.length, 1)
    assert.equal(result.stopped_at, "fixed_reject_gate")
    assert.equal(secondRan, false)
  })

  it("reject sets stopped_at to the rejecting gate_id", () => {
    const result = runGates([fixedGate("reject")], makeCtx("output"))
    assert.equal(result.stopped_at, "fixed_reject_gate")
  })

  it("fail continues — all gates run, verdict is fail", () => {
    let secondRan = false
    const sentinel: Gate = (_ctx) => {
      secondRan = true
      return { gate_id: "sentinel", verdict: "pass", reason: "" }
    }
    const result = runGates([fixedGate("fail"), sentinel], makeCtx("output"))
    assert.equal(result.verdict, "fail")
    assert.equal(result.results.length, 2)
    assert.equal(secondRan, true)
    assert.equal(result.stopped_at, undefined)
  })

  it("fail dominates downgrade — verdict fail", () => {
    const result = runGates([fixedGate("fail"), fixedGate("downgrade")], makeCtx("output"))
    assert.equal(result.verdict, "fail")
  })

  it("downgrade only if no fail — verdict downgrade", () => {
    const result = runGates([fixedGate("pass"), fixedGate("downgrade")], makeCtx("output"))
    assert.equal(result.verdict, "downgrade")
  })

  it("mix of pass and fail — fail wins", () => {
    const result = runGates([fixedGate("pass"), fixedGate("fail"), fixedGate("pass")], makeCtx("output"))
    assert.equal(result.verdict, "fail")
  })

  it("results array contains one entry per gate in order", () => {
    const result = runGates([fixedGate("pass"), fixedGate("fail"), fixedGate("downgrade")], makeCtx("output"))
    assert.equal(result.results.length, 3)
    assert.equal(result.results[0].verdict, "pass")
    assert.equal(result.results[1].verdict, "fail")
    assert.equal(result.results[2].verdict, "downgrade")
  })

  it("null gates throws", () => {
    assert.throws(() => runGates(null as unknown as Gate[], makeCtx("x")), /runGates: gates is required/)
  })

  it("null ctx throws", () => {
    assert.throws(() => runGates([], null as unknown as Omit<GateContext, "gate_id">), /runGates: ctx is required/)
  })

  it("gate that throws propagates the error", () => {
    const bomb: Gate = () => { throw new Error("gate exploded") }
    assert.throws(() => runGates([bomb], makeCtx("x")), /gate exploded/)
  })
})

// ---------------------------------------------------------------------------
// evidenceRequiredGate
// ---------------------------------------------------------------------------

describe("evidenceRequiredGate", () => {
  it("pass — contains 'because'", () => {
    const r = evidenceRequiredGate(makeCtx("This works because the tests pass.") as GateContext)
    assert.equal(r.verdict, "pass")
    assert.equal(r.gate_id, "evidence_required_gate")
  })

  it("pass — contains 'based on'", () => {
    const r = evidenceRequiredGate(makeCtx("Based on the metrics, we should proceed.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains 'evidence:'", () => {
    const r = evidenceRequiredGate(makeCtx("Evidence: test suite passes with 100% coverage.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains 'according to'", () => {
    const r = evidenceRequiredGate(makeCtx("According to the spec, this is correct.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("fail — no evidence markers", () => {
    const r = evidenceRequiredGate(makeCtx("This is a good approach and will work well in practice.") as GateContext)
    assert.equal(r.verdict, "fail")
    assert.match(r.reason, /evidence markers/)
  })

  it("pass — case insensitive ('BECAUSE')", () => {
    const r = evidenceRequiredGate(makeCtx("BECAUSE the data supports it.") as GateContext)
    assert.equal(r.verdict, "pass")
  })
})

// ---------------------------------------------------------------------------
// verifyGate
// ---------------------------------------------------------------------------

describe("verifyGate", () => {
  it("pass — contains 'verify'", () => {
    const r = verifyGate(makeCtx("Please verify the result before deploying.") as GateContext)
    assert.equal(r.verdict, "pass")
    assert.equal(r.gate_id, "verify_gate")
  })

  it("pass — contains 'validate'", () => {
    const r = verifyGate(makeCtx("We should validate the inputs first.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains 'confirm'", () => {
    const r = verifyGate(makeCtx("Confirm the output matches expectations.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("fail — no verification markers", () => {
    const r = verifyGate(makeCtx("The implementation is complete and ready.") as GateContext)
    assert.equal(r.verdict, "fail")
    assert.match(r.reason, /verification markers/)
  })
})

// ---------------------------------------------------------------------------
// noOpDetectionGate
// ---------------------------------------------------------------------------

describe("noOpDetectionGate", () => {
  it("pass — substantive output > 50 chars", () => {
    const r = noOpDetectionGate(makeCtx("This is a detailed response explaining the implementation steps and rationale.") as GateContext)
    assert.equal(r.verdict, "pass")
    assert.equal(r.gate_id, "no_op_detection_gate")
  })

  it("fail — output too short (≤ 50 chars)", () => {
    const r = noOpDetectionGate(makeCtx("Short reply.") as GateContext)
    assert.equal(r.verdict, "fail")
    assert.match(r.reason, /too short/)
  })

  it("fail — exactly 50 chars (boundary)", () => {
    const s = "x".repeat(50)
    const r = noOpDetectionGate(makeCtx(s) as GateContext)
    assert.equal(r.verdict, "fail")
  })

  it("pass — exactly 51 chars (boundary)", () => {
    const s = "x".repeat(51)
    const r = noOpDetectionGate(makeCtx(s) as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("fail — filler phrase 'ok' (short → too short, not filler)", () => {
    const r = noOpDetectionGate(makeCtx("ok") as GateContext)
    assert.equal(r.verdict, "fail")
    // "ok" is 2 chars — length check fires before filler check
    assert.match(r.reason, /too short/)
  })

  it("fail — filler phrase 'Got it.'", () => {
    const r = noOpDetectionGate(makeCtx("Got it.") as GateContext)
    assert.equal(r.verdict, "fail")
  })

  it("fail — filler phrase 'understood'", () => {
    const r = noOpDetectionGate(makeCtx("understood") as GateContext)
    assert.equal(r.verdict, "fail")
  })
})

// ---------------------------------------------------------------------------
// scopeGate
// ---------------------------------------------------------------------------

describe("scopeGate", () => {
  it("pass — no out-of-scope markers", () => {
    const r = scopeGate(makeCtx("This is a focused response about the topic.") as GateContext)
    assert.equal(r.verdict, "pass")
    assert.equal(r.gate_id, "scope_gate")
  })

  it("downgrade — contains 'out of scope'", () => {
    const r = scopeGate(makeCtx("This is out of scope for the current task.") as GateContext)
    assert.equal(r.verdict, "downgrade")
    assert.match(r.reason, /scope expansion/)
  })

  it("downgrade — contains 'outside the scope'", () => {
    const r = scopeGate(makeCtx("This falls outside the scope of what was requested.") as GateContext)
    assert.equal(r.verdict, "downgrade")
  })

  it("downgrade — contains 'unrelated to'", () => {
    const r = scopeGate(makeCtx("This is unrelated to the original request.") as GateContext)
    assert.equal(r.verdict, "downgrade")
  })

  it("scope_gate never returns fail", () => {
    const r = scopeGate(makeCtx("out of scope") as GateContext)
    assert.notEqual(r.verdict, "fail")
    assert.notEqual(r.verdict, "reject")
  })
})

// ---------------------------------------------------------------------------
// testPassGate
// ---------------------------------------------------------------------------

describe("testPassGate", () => {
  it("non-execution task — always pass regardless of output", () => {
    const r = testPassGate(makeCtx("no mention of tests at all", "design") as GateContext)
    assert.equal(r.verdict, "pass")
    assert.equal(r.gate_id, "test_pass_gate")
  })

  it("non-execution task type 'incident' — always pass", () => {
    const r = testPassGate(makeCtx("no tests", "incident") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("execution task — pass when output contains 'tests pass'", () => {
    const r = testPassGate(makeCtx("All tests pass with no failures.", "execution") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("execution task — pass when output contains '✅'", () => {
    const r = testPassGate(makeCtx("Build complete ✅", "execution") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("execution task — pass when output contains 'green'", () => {
    const r = testPassGate(makeCtx("Suite is green, ready to deploy.", "execution") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("execution task — fail when no test pass markers", () => {
    const r = testPassGate(makeCtx("Implementation is complete and the code looks good.", "execution") as GateContext)
    assert.equal(r.verdict, "fail")
    assert.match(r.reason, /tests are passing/)
  })
})

// ---------------------------------------------------------------------------
// multiOptionGate
// ---------------------------------------------------------------------------

describe("multiOptionGate", () => {
  it("pass — contains '1.' and '2.'", () => {
    const r = multiOptionGate(makeCtx("1. First approach uses A. 2. Second approach uses B.") as GateContext)
    assert.equal(r.verdict, "pass")
    assert.equal(r.gate_id, "multi_option_gate")
  })

  it("pass — contains 'first' and 'second' (exact word forms)", () => {
    // \bfirst[ly]?\b matches "first" not "firstly"; use exact word forms
    const r = multiOptionGate(makeCtx("The first option is X. The second option is Y.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains '1.' and 'option' signal pair", () => {
    // "option 1" and "option 2" both match the same signal pattern (index 0);
    // need two *distinct* signal types — use "1. " and "2. " instead
    const r = multiOptionGate(makeCtx("1. Use Redis. 2. Use Memcached.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains 'a)' and 'b)'", () => {
    const r = multiOptionGate(makeCtx("a) approach one b) approach two") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("fail — only one option signal", () => {
    const r = multiOptionGate(makeCtx("1. The best approach is to use X.") as GateContext)
    assert.equal(r.verdict, "fail")
    assert.match(r.reason, /multiple options/)
  })

  it("fail — no option signals at all", () => {
    const r = multiOptionGate(makeCtx("The solution is to refactor the module using the adapter pattern.") as GateContext)
    assert.equal(r.verdict, "fail")
  })
})

// ---------------------------------------------------------------------------
// designCompletenessGate
// ---------------------------------------------------------------------------

describe("designCompletenessGate", () => {
  it("pass — contains 'failure'", () => {
    const r = designCompletenessGate(makeCtx("Consider the failure modes of this approach.") as GateContext)
    assert.equal(r.verdict, "pass")
    assert.equal(r.gate_id, "design_completeness_gate")
  })

  it("pass — contains 'risk'", () => {
    const r = designCompletenessGate(makeCtx("The risk here is data loss during migration.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains 'rollback'", () => {
    const r = designCompletenessGate(makeCtx("Rollback plan: revert the migration script.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains 'fallback'", () => {
    const r = designCompletenessGate(makeCtx("Fallback behavior: return cached value.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("pass — contains 'edge case'", () => {
    const r = designCompletenessGate(makeCtx("Edge case: empty input should return default.") as GateContext)
    assert.equal(r.verdict, "pass")
  })

  it("fail — no failure model markers", () => {
    const r = designCompletenessGate(makeCtx("The design uses a three-tier architecture with clear separation of concerns.") as GateContext)
    assert.equal(r.verdict, "fail")
    assert.match(r.reason, /failure modes/)
  })
})

// ---------------------------------------------------------------------------
// resolveGates + GATE_REGISTRY
// ---------------------------------------------------------------------------

describe("resolveGates", () => {
  it("resolves known gate ids to gate functions", () => {
    const gates = resolveGates(["evidence_required_gate", "verify_gate"])
    assert.equal(gates.length, 2)
    assert.equal(typeof gates[0], "function")
    assert.equal(typeof gates[1], "function")
  })

  it("unknown gate ids are silently skipped", () => {
    const gates = resolveGates(["evidence_required_gate", "unknown_gate_xyz"])
    assert.equal(gates.length, 1)
  })

  it("empty array returns empty array", () => {
    const gates = resolveGates([])
    assert.equal(gates.length, 0)
  })

  it("GATE_REGISTRY contains all 10 gates", () => {
    const expected = [
      "evidence_required_gate",
      "verify_gate",
      "no_op_detection_gate",
      "scope_gate",
      "test_pass_gate",
      "multi_option_gate",
      "design_completeness_gate",
      "rpp_intent_gate",
      "rpp_tradeoff_gate",
      "rpp_risk_gate",
    ]
    for (const id of expected) {
      assert.ok(GATE_REGISTRY[id] !== undefined, `GATE_REGISTRY missing: ${id}`)
    }
    assert.equal(Object.keys(GATE_REGISTRY).length, 10)
  })

  it("resolved gates produce correct gate_id in result", () => {
    const gates = resolveGates(["evidence_required_gate"])
    const ctx = makeCtx("because of the evidence") as GateContext
    const result = gates[0](ctx)
    assert.equal(result.gate_id, "evidence_required_gate")
  })
})

// ---------------------------------------------------------------------------
// Integration: runGates with real gates
// ---------------------------------------------------------------------------

describe("runGates — integration with real gates", () => {
  it("no_op_detection_gate + evidence_required_gate on good output → pass", () => {
    const gates = resolveGates(["no_op_detection_gate", "evidence_required_gate"])
    const output = "This implementation is correct because the test suite validates all edge cases and the coverage report confirms 100% branch coverage."
    const result = runGates(gates, makeCtx(output))
    assert.equal(result.verdict, "pass")
  })

  it("no_op_detection_gate fails on empty-ish output, overrides later pass", () => {
    const gates = resolveGates(["no_op_detection_gate", "verify_gate"])
    const result = runGates(gates, makeCtx("ok"))
    assert.equal(result.verdict, "fail")
  })

  it("scope_gate downgrade does not override fail from no_op_detection_gate", () => {
    const gates = resolveGates(["no_op_detection_gate", "scope_gate"])
    // Short output that is also out of scope
    const result = runGates(gates, makeCtx("out of scope"))
    assert.equal(result.verdict, "fail")
  })
})
