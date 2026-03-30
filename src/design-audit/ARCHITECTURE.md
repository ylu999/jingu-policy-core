# Jingu Design Audit — Architecture Principles

## 0. Purpose

Design Audit exists to ensure that:

> **Agent system designs are machine-checkable, enforceable, and stable over time.**

It is not a style checker.
It is a **governance compiler** for agent workflows.

---

## 1. Two Layers of Principles

Design Audit enforces two layers:

---

### 1.1 Design Principles (Correctness)

These define **what a correct system looks like**:

- **State Machine Completeness**
  All execution paths must terminate with a deterministic verdict.

- **Layer Separation**
  Syntax, structure, semantics, and execution must not be conflated.

- **Recoverability**
  Retry is only allowed for recoverable errors.

- **Contract Enforcement**
  Violations of output contract must be explicitly classified and blocked.

---

### 1.2 Execution Principles (Enforcement)

These define **how correctness is enforced in code**:

- **Structured Decision**
  All decisions (e.g. accepting warnings) must be explicit and recorded in data.

- **Semantic Explicitness**
  Rule meaning must be encoded in types, not inferred.

- **Stable Contract**
  Public issue codes are API and must remain stable.

- **Determinism**
  Same input → same lint output (including ordering).

- **Actionable Failure**
  Every issue must indicate how it can be resolved.

---

### 1.3 Boundary Principle: Definition vs Usage

Governance principles, rule semantics, severity models, and issue contracts
must be defined in `jingu-policy-core` as the reusable source of truth.

Workflow adapters (for example `.claude` rule files) may reference these assets
and enforce when they must be used, but must not redefine or duplicate the
governing principles themselves.

**Reason:**
Duplicated canonical definitions drift over time and create parallel governance
layers that cannot be reconciled.

**Invariant:**
There must be exactly one canonical definition for every governance principle.

---

## 2. Severity Model (Execution Boundary)

```
ERROR    → invariant violation → must block
WARNING  → heuristic deviation → requires explicit justification
INFO     → observation         → no action required
```

---

### 2.1 Formal Definition

```ts
isDesignValid(spec) :=
  lintLoopDesign(spec).every(i => i.severity !== "error")
```

---

### 2.2 Enforcement Contract

| Severity | Meaning                           | Required Action                     |
| -------- | --------------------------------- | ----------------------------------- |
| error    | Violates system invariant         | Must fix before implementation      |
| warning  | Deviates from recommended pattern | Must provide explicit justification |
| info     | Non-blocking observation          | Log only                            |

---

### 2.3 Warning Justification Rule

All warnings must be explicitly acknowledged:

```ts
type LoopDesignSpec = {
  // ...
  justifications?: Record<string, string>  // key = issue.code
}
```

Invariant:

```
∀ warning w:
  spec.justifications[w.code] must exist
```

---

## 3. Rule Model

Each rule must define:

```ts
type Rule = {
  code: string                                      // stable identifier (public contract)
  kind: "invariant" | "heuristic" | "observation"  // what the rule is
  severity: "error" | "warning" | "info"           // how the system reacts
  message: string
  remediation_hint?: string
}
```

---

### 3.1 Rule Semantics

- `kind` defines **what the rule is**
- `severity` defines **how the system reacts**

These must not be conflated.

---

## 4. Output Determinism

Lint output must be stable.

Sorting order:

```
1. severity (error → warning → info)
2. rule
3. code
```

Invariant:

```
same spec → identical issue list (including order)
```

---

## 5. Issue Code Contract

`DesignIssue.code` is a **public API**.

Rules:

- Must be stable once released
- Must not be renamed casually
- Can be deprecated, but not silently changed

Reason:

> External systems depend on codes for governance logic (justification maps, CI policies, dashboards).

---

## 6. Failure Model

Design Audit treats failures as structured signals:

```
issue → classified → actionable → trackable
```

Each issue must be:

- **Typed** (code)
- **Located** (rule)
- **Actionable** (hint)
- **Deterministic**

---

## 7. Principle → Rule Mapping

Every design principle must map to at least one concrete rule.
Rules that are `kind: "invariant"` must emit `severity: "error"`.

| Design Principle            | Rule Code(s)                                                   |
| --------------------------- | -------------------------------------------------------------- |
| State Machine Completeness  | MISSING_INVALID_OUTPUT_VERDICT, UNBOUNDED_RETRY_RISK           |
| Layer Separation            | MIXED_LAYER_RETRY, SEMANTICS_WITHOUT_STRUCTURE_GATE            |
| Recoverability              | NON_RECOVERABLE_RETRY, UNDEFINED_RETRY_CODE, RETRY_WITH_NO_TRIGGER |
| Contract Enforcement        | CONTRACT_VIOLATIONS_WITHOUT_VERDICT, SYNTAX_ERROR_RETRIED      |
| Structured Decision         | WARNING_WITHOUT_JUSTIFICATION (+ justifications field)         |
| Semantic Explicitness       | kind field on DesignIssue                                      |
| Stable Contract             | Code registry in types.ts                                      |
| Determinism                 | sort in lintLoopDesign()                                       |
| Actionable Failure          | remediation_hint field on DesignIssue                          |

---

## 8. Non-Goals

Design Audit does NOT:

- Execute tasks
- Evaluate LLM correctness
- Replace runtime gates
- Enforce business-specific rules

It only validates **design-level correctness and stability**.

---

## 9. System Role

Within Jingu:

```
jingu-protocol     → defines structure
jingu-trust-gate   → enforces evidence admission
jingu-policy-core  → enforces governance
                      ↑
                Design Audit lives here
```

---

## 10. Core Invariant (One Sentence)

> **No design is allowed to proceed unless it is structurally valid, deterministically analyzable, and explicitly justified where it deviates.**

---

## 11. Adapter Contract (for integration builders)

If you are building a CI adapter, IDE plugin, workflow integration, or any system
that wraps or extends Design Audit, the following rules apply:

**Rule A — Do not redefine what `jingu-policy-core` already defines.**
`IssueSeverity`, `RuleKind`, `DesignIssue`, issue codes, severity semantics,
and rule logic are the canonical source of truth. Your adapter must consume
them, not reproduce them.

**Rule B — Do not hardcode issue codes as strings.**
Import issue codes from `@jingu/policy-core` types or compare against
`DesignIssue.code` values. Hardcoding `"UNBOUNDED_RETRY_RISK"` in your
adapter creates a dependency that will break silently when you fail to update.

**Rule C — Do not invent a parallel severity model.**
If your tool needs to filter or gate on severity, use `DesignIssue.severity`
directly. Do not map it to a second scale (e.g. critical/major/minor).
Two severity scales in the same pipeline cannot be reconciled.

**Rule D — Treat issue codes as a public API.**
`DesignIssue.code` values follow the stability contract in §5. Build
justification maps, CI policies, and allow/deny lists against these codes.
They will not be renamed without deprecation.

**Rule E — Expose `remediation_hint` to the user.**
Every issue includes a `remediation_hint`. Your adapter should surface it
wherever it surfaces the issue message. Suppressing it removes the only
machine-readable next-step guidance.

**Summary:** your adapter adds *when to run* and *how to present results*,
not *what the rules mean*. The rules live here.

---

## Usage

```
Write LoopDesignSpec → lint → fix errors → justify warnings → then implement.
```
