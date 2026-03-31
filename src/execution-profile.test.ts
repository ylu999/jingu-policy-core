// execution-profile.test.ts
// Unit tests for resolveExecutionProfile and mergeProfiles

import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { resolveExecutionProfile, mergeProfiles } from "./execution-profile.js"
import type { ExecutionProfile } from "./execution-profile.js"
import type { TaskContext } from "./resolver/policy-resolver.js"

function ctx(task_type: TaskContext["task_type"], risk_level: TaskContext["risk_level"] = "low"): TaskContext {
  return { task_type, risk_level }
}

describe("resolveExecutionProfile — task type rules", () => {
  it("design → exhaustive (token-intensive)", () => {
    assert.equal(resolveExecutionProfile(ctx("design")), "exhaustive")
  })

  it("planning → exhaustive (structurally similar to design)", () => {
    assert.equal(resolveExecutionProfile(ctx("planning")), "exhaustive")
  })

  it("incident → exhaustive (high-stakes, depth required)", () => {
    assert.equal(resolveExecutionProfile(ctx("incident")), "exhaustive")
  })

  it("reasoning → standard", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning")), "standard")
  })

  it("debugging → standard", () => {
    assert.equal(resolveExecutionProfile(ctx("debugging")), "standard")
  })

  it("execution → standard", () => {
    assert.equal(resolveExecutionProfile(ctx("execution")), "standard")
  })

  it("verification → standard", () => {
    assert.equal(resolveExecutionProfile(ctx("verification")), "standard")
  })

  it("problem_framing → standard", () => {
    assert.equal(resolveExecutionProfile(ctx("problem_framing")), "standard")
  })

  it("communication → standard", () => {
    assert.equal(resolveExecutionProfile(ctx("communication")), "standard")
  })

  it("learning → standard", () => {
    assert.equal(resolveExecutionProfile(ctx("learning")), "standard")
  })
})

describe("resolveExecutionProfile — risk level escalation", () => {
  it("reasoning + high risk → exhaustive (escalated from standard)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "high")), "exhaustive")
  })

  it("reasoning + critical risk → exhaustive (escalated from standard)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "critical")), "exhaustive")
  })

  it("reasoning + medium risk → standard (no escalation)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "medium")), "standard")
  })

  it("reasoning + low risk → standard (no escalation)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "low")), "standard")
  })

  it("design + high risk → exhaustive (already exhaustive, stays exhaustive)", () => {
    assert.equal(resolveExecutionProfile(ctx("design", "high")), "exhaustive")
  })

  it("execution + critical risk → exhaustive (escalated)", () => {
    assert.equal(resolveExecutionProfile(ctx("execution", "critical")), "exhaustive")
  })
})

describe("mergeProfiles — higher profile wins", () => {
  it("exhaustive + standard → exhaustive", () => {
    assert.equal(mergeProfiles("exhaustive", "standard"), "exhaustive")
  })

  it("standard + exhaustive → exhaustive", () => {
    assert.equal(mergeProfiles("standard", "exhaustive"), "exhaustive")
  })

  it("standard + fast → standard", () => {
    assert.equal(mergeProfiles("standard", "fast"), "standard")
  })

  it("fast + standard → standard", () => {
    assert.equal(mergeProfiles("fast", "standard"), "standard")
  })

  it("fast + fast → fast", () => {
    assert.equal(mergeProfiles("fast", "fast"), "fast")
  })

  it("standard + standard → standard", () => {
    assert.equal(mergeProfiles("standard", "standard"), "standard")
  })

  it("exhaustive + exhaustive → exhaustive", () => {
    assert.equal(mergeProfiles("exhaustive", "exhaustive"), "exhaustive")
  })

  it("fast + exhaustive → exhaustive", () => {
    assert.equal(mergeProfiles("fast", "exhaustive"), "exhaustive")
  })

  it("exhaustive + fast → exhaustive", () => {
    assert.equal(mergeProfiles("exhaustive", "fast"), "exhaustive")
  })
})
