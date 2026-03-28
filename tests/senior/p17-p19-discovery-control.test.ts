import { strict as assert } from "node:assert"
import { test, describe } from "node:test"
import {
  p17ExternalizeOnDiscovery,
  p18BlockerPrecedence,
  p19ContextBudget,
} from "../../src/policies/senior/p17-p19-discovery-control"
import type { Input } from "../../src/types"

// --- Base input helpers ---

function baseInput(overrides: Partial<Input> = {}): Input {
  return {
    task: { objective: "Fix failing test in discount module" },
    proposal: {
      summary: "Analyze and fix the discount calculation bug",
      plannedActions: [
        { type: "read", intent: "read the failing test output" },
        { type: "analysis", intent: "trace the calculation path" },
        { type: "write", intent: "fix the off-by-one in discount.ts" },
      ],
    },
    evidence: {
      observations: ["test fails with wrong discount value"],
      failureSignals: [],
    },
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P17 — Externalize and Split on Discovery
// ─────────────────────────────────────────────────────────────────────────────

describe("P17 — Externalize and Split on Discovery", () => {
  test("no violations — clean single-concern proposal with no failures", () => {
    const input = baseInput()
    const violations = p17ExternalizeOnDiscovery(input)
    assert.equal(violations.length, 0)
  })

  test("no violations — multi-concern proposal with discoveries recorded", () => {
    const input = baseInput({
      proposal: {
        summary: "Fix multiple issues discovered",
        plannedActions: [
          { type: "read", intent: "read test output" },
          { type: "write", intent: "fix database schema migration" },
          { type: "write", intent: "update auth token configuration" },
          { type: "command", intent: "run CI pipeline to verify" },
        ],
      },
      discoveries: [
        { id: "disc-001", summary: "Schema migration pending before tests run", type: "blocker", resolvedInline: true },
        { id: "disc-002", summary: "Auth token expiry config out of date", type: "followup" },
      ],
    })
    const violations = p17ExternalizeOnDiscovery(input)
    assert.equal(violations.length, 0)
  })

  test("warning — proposal spans 3+ distinct concern areas with no discoveries", () => {
    const input = baseInput({
      proposal: {
        summary: "Fix everything found",
        plannedActions: [
          { type: "write", intent: "fix database migration schema issue" },
          { type: "write", intent: "update auth token configuration" },
          { type: "command", intent: "run CI pipeline lint checks" },
          { type: "write", intent: "update API endpoint route handler" },
        ],
      },
    })
    const violations = p17ExternalizeOnDiscovery(input)
    const p17 = violations.find(v => v.policyId === "P17")
    assert.ok(p17, "should have P17 violation")
    assert.equal(p17!.severity, "warning")
    assert.ok(p17!.message.includes("distinct concern"))
  })

  test("reject — multiple failure signals with no discoveries", () => {
    const input = baseInput({
      evidence: {
        failureSignals: ["terraform_not_found", "schema_mismatch"],
        observations: [],
      },
    })
    const violations = p17ExternalizeOnDiscovery(input)
    const p17 = violations.find(v => v.policyId === "P17")
    assert.ok(p17, "should have P17 violation")
    assert.equal(p17!.severity, "reject")
    assert.ok(p17!.message.includes("failure signal"))
  })

  test("warning — discovery with no type classification", () => {
    const input = baseInput({
      discoveries: [
        { id: "disc-001", summary: "Found unexpected state in config", type: undefined as any },
      ],
    })
    const violations = p17ExternalizeOnDiscovery(input)
    const p17 = violations.find(v => v.policyId === "P17" && v.message.includes("no type"))
    assert.ok(p17, "should warn about missing type")
    assert.equal(p17!.severity, "warning")
  })

  test("warning — discovery with empty summary", () => {
    const input = baseInput({
      discoveries: [
        { id: "disc-002", summary: "ok", type: "followup" },
      ],
    })
    const violations = p17ExternalizeOnDiscovery(input)
    const p17 = violations.find(v => v.policyId === "P17" && v.message.includes("summary"))
    assert.ok(p17, "should warn about insufficient summary")
    assert.equal(p17!.severity, "warning")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// P18 — Blocker Precedence
// ─────────────────────────────────────────────────────────────────────────────

describe("P18 — Blocker Precedence", () => {
  test("no violations — no blockers and no gating signals", () => {
    const input = baseInput()
    const violations = p18BlockerPrecedence(input)
    assert.equal(violations.length, 0)
  })

  test("no violations — blocker recorded and resolved inline", () => {
    const input = baseInput({
      discoveries: [
        { id: "disc-001", summary: "terraform not installed", type: "blocker", resolvedInline: true },
      ],
    })
    const violations = p18BlockerPrecedence(input)
    assert.equal(violations.length, 0)
  })

  test("block — unresolved blocker while proposal proceeds", () => {
    const input = baseInput({
      discoveries: [
        { id: "disc-001", summary: "DB schema migration is pending", type: "blocker", resolvedInline: false },
      ],
    })
    const violations = p18BlockerPrecedence(input)
    const p18 = violations.find(v => v.policyId === "P18")
    assert.ok(p18, "should have P18 block violation")
    assert.equal(p18!.severity, "block")
    assert.ok(p18!.message.includes("unresolved blocker"))
  })

  test("block — 'not found' signal in evidence while mutating actions proceed", () => {
    const input = baseInput({
      evidence: {
        observations: ["terraform: command not found in PATH"],
        failureSignals: [],
      },
    })
    const violations = p18BlockerPrecedence(input)
    const p18 = violations.find(v => v.policyId === "P18")
    assert.ok(p18, "should have P18 block violation for tool not found")
    assert.equal(p18!.severity, "block")
  })

  test("block — 'permission denied' signal with write actions", () => {
    const input = baseInput({
      evidence: {
        observations: ["Error: permission denied writing to /etc/config"],
        failureSignals: [],
      },
    })
    const violations = p18BlockerPrecedence(input)
    const p18 = violations.find(v => v.policyId === "P18")
    assert.ok(p18, "should block on permission denied")
    assert.equal(p18!.severity, "block")
  })

  test("no block — 'not found' signal but no mutating actions", () => {
    const input = baseInput({
      proposal: {
        summary: "Only reading and analysis",
        plannedActions: [
          { type: "read", intent: "read config file" },
          { type: "analysis", intent: "analyze the error message" },
        ],
      },
      evidence: {
        observations: ["terraform: command not found"],
        failureSignals: [],
      },
    })
    const violations = p18BlockerPrecedence(input)
    // May warn from P17 but should not BLOCK from P18
    const p18Block = violations.find(v => v.policyId === "P18" && v.severity === "block")
    assert.equal(p18Block, undefined, "should not block when no mutating actions")
  })

  test("block — merge conflict signal with write actions", () => {
    const input = baseInput({
      evidence: {
        commandResults: ["error: merge conflict in src/main.ts cannot merge"],
        failureSignals: [],
      },
    })
    const violations = p18BlockerPrecedence(input)
    const p18 = violations.find(v => v.policyId === "P18")
    assert.ok(p18, "should block on merge conflict")
    assert.equal(p18!.severity, "block")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// P19 — Context / Scope Budget
// ─────────────────────────────────────────────────────────────────────────────

describe("P19 — Context Budget", () => {
  test("no violations — narrow well-scoped proposal", () => {
    const input = baseInput()
    const violations = p19ContextBudget(input)
    assert.equal(violations.length, 0)
  })

  test("reject — openBranches exceeds limit", () => {
    const input = baseInput({
      executionBudget: { openBranches: 6 },
    })
    const violations = p19ContextBudget(input)
    const p19 = violations.find(v => v.policyId === "P19")
    assert.ok(p19, "should have P19 violation")
    assert.equal(p19!.severity, "reject")
    assert.ok(p19!.message.includes("open branches"))
  })

  test("reject — concurrentFindings exceeds limit", () => {
    const input = baseInput({
      executionBudget: { concurrentFindings: 4 },
    })
    const violations = p19ContextBudget(input)
    const p19 = violations.find(v => v.policyId === "P19")
    assert.ok(p19, "should have P19 violation")
    assert.equal(p19!.severity, "reject")
    assert.ok(p19!.message.includes("concurrent findings"))
  })

  test("warning — subsystemsTouched exceeds limit", () => {
    const input = baseInput({
      executionBudget: {
        subsystemsTouched: ["auth", "database", "api", "cache"],
      },
    })
    const violations = p19ContextBudget(input)
    const p19 = violations.find(v => v.policyId === "P19")
    assert.ok(p19, "should have P19 violation")
    assert.equal(p19!.severity, "warning")
    assert.ok(p19!.message.includes("subsystem"))
  })

  test("warning — many unresolved non-blocker discoveries accumulate", () => {
    const input = baseInput({
      discoveries: [
        { id: "d1", summary: "Found linting issues in 5 files", type: "followup" },
        { id: "d2", summary: "README outdated in 3 sections", type: "followup" },
        { id: "d3", summary: "CI config uses deprecated syntax", type: "followup" },
        { id: "d4", summary: "Test coverage below 80% in auth module", type: "followup" },
      ],
    })
    const violations = p19ContextBudget(input)
    const p19 = violations.find(v => v.policyId === "P19")
    assert.ok(p19, "should warn about accumulating discoveries")
    assert.equal(p19!.severity, "warning")
  })

  test("no violation — discoveries marked spawnSuggested don't count toward budget", () => {
    const input = baseInput({
      discoveries: [
        { id: "d1", summary: "Found linting issues", type: "followup", spawnSuggested: true },
        { id: "d2", summary: "README outdated", type: "followup", spawnSuggested: true },
        { id: "d3", summary: "CI config deprecated", type: "followup", spawnSuggested: true },
        { id: "d4", summary: "Test coverage low", type: "followup", spawnSuggested: true },
      ],
    })
    const violations = p19ContextBudget(input)
    const p19 = violations.find(v => v.policyId === "P19")
    assert.equal(p19, undefined, "spawn-suggested discoveries should not count toward budget")
  })

  test("warning — proposal intent areas span too many distinct concerns", () => {
    const input = baseInput({
      proposal: {
        summary: "Fix everything at once",
        plannedActions: [
          { type: "write", intent: "fix database schema migration issue" },
          { type: "command", intent: "update auth token configuration setting" },
          { type: "write", intent: "update CI pipeline workflow yaml" },
          { type: "write", intent: "fix API endpoint route handler" },
          { type: "command", intent: "install missing npm package dependency" },
        ],
      },
    })
    const violations = p19ContextBudget(input)
    const p19 = violations.find(v => v.policyId === "P19" && v.message.includes("concern"))
    assert.ok(p19, "should warn about too many concern areas")
    assert.equal(p19!.severity, "warning")
  })
})
