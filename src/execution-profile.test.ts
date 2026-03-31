// execution-profile.test.ts
// Unit tests for resolveExecutionProfile and mergeProfiles (v2: 4-tier taxonomy)

import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { resolveExecutionProfile, mergeProfiles } from "./execution-profile.js"
import type { TaskContext } from "./resolver/policy-resolver.js"

function ctx(
  task_type: TaskContext["task_type"],
  risk_level: TaskContext["risk_level"] = "low",
  complexity_class?: TaskContext["complexity_class"],
): TaskContext {
  return { task_type, risk_level, complexity_class }
}

describe("resolveExecutionProfile — rule 1+2: exhaustive task types", () => {
  it("design (default complexity) → exhaustive", () => {
    assert.equal(resolveExecutionProfile(ctx("design")), "exhaustive")
  })

  it("planning (default complexity) → exhaustive", () => {
    assert.equal(resolveExecutionProfile(ctx("planning")), "exhaustive")
  })

  it("incident (default complexity) → exhaustive", () => {
    assert.equal(resolveExecutionProfile(ctx("incident")), "exhaustive")
  })

  it("design + complexity_class=standard → exhaustive (explicit standard = default)", () => {
    assert.equal(resolveExecutionProfile(ctx("design", "low", "standard")), "exhaustive")
  })

  it("design + complexity_class=heavy → deep_exhaustive", () => {
    assert.equal(resolveExecutionProfile(ctx("design", "low", "heavy")), "deep_exhaustive")
  })

  it("planning + complexity_class=heavy → deep_exhaustive", () => {
    assert.equal(resolveExecutionProfile(ctx("planning", "low", "heavy")), "deep_exhaustive")
  })

  it("incident + complexity_class=heavy → deep_exhaustive", () => {
    assert.equal(resolveExecutionProfile(ctx("incident", "low", "heavy")), "deep_exhaustive")
  })
})

describe("resolveExecutionProfile — rule 4: standard task types", () => {
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

describe("resolveExecutionProfile — rule 3: risk level escalation", () => {
  it("reasoning + high risk → deep_exhaustive (escalated from standard)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "high")), "deep_exhaustive")
  })

  it("reasoning + critical risk → deep_exhaustive (escalated from standard)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "critical")), "deep_exhaustive")
  })

  it("reasoning + medium risk → standard (no escalation)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "medium")), "standard")
  })

  it("reasoning + low risk → standard (no escalation)", () => {
    assert.equal(resolveExecutionProfile(ctx("reasoning", "low")), "standard")
  })

  it("design + high risk → deep_exhaustive (task is exhaustive, risk bumps to deep)", () => {
    assert.equal(resolveExecutionProfile(ctx("design", "high")), "deep_exhaustive")
  })

  it("execution + critical risk → deep_exhaustive (escalated from standard)", () => {
    assert.equal(resolveExecutionProfile(ctx("execution", "critical")), "deep_exhaustive")
  })

  it("design + heavy + high risk → deep_exhaustive (both paths point to deep)", () => {
    assert.equal(resolveExecutionProfile(ctx("design", "high", "heavy")), "deep_exhaustive")
  })
})

describe("mergeProfiles — higher profile wins (4-tier order)", () => {
  it("deep_exhaustive + exhaustive → deep_exhaustive", () => {
    assert.equal(mergeProfiles("deep_exhaustive", "exhaustive"), "deep_exhaustive")
  })

  it("exhaustive + deep_exhaustive → deep_exhaustive", () => {
    assert.equal(mergeProfiles("exhaustive", "deep_exhaustive"), "deep_exhaustive")
  })

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

  it("deep_exhaustive + deep_exhaustive → deep_exhaustive", () => {
    assert.equal(mergeProfiles("deep_exhaustive", "deep_exhaustive"), "deep_exhaustive")
  })

  it("fast + deep_exhaustive → deep_exhaustive", () => {
    assert.equal(mergeProfiles("fast", "deep_exhaustive"), "deep_exhaustive")
  })

  it("deep_exhaustive + fast → deep_exhaustive", () => {
    assert.equal(mergeProfiles("deep_exhaustive", "fast"), "deep_exhaustive")
  })
})
