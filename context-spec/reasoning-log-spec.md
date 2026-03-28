# Reasoning Log — .jingu/reasoning-log/

Every agent run that passes enforceReasoningFrame() should write its reasoning to:

.jingu/reasoning-log/<timestamp>-<task-id>.json

Format:
{
  "taskId": "...",
  "timestamp": "ISO",
  "reasoningFrame": { ... },
  "gateResult": "accept" | "reject",
  "decision": "accept" | "reject" | "block"
}

Purpose:
- Debug agent thinking over time
- Compare bad vs good reasoning (demo)
- Audit trail for decisions
- Handoff context between sessions (P16)
