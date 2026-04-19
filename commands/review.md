---
description: One-shot Claude review of a Codex response (without the Stop hook).
argument-hint: "<codex response to review>" [--model <id>] [--transport auto|claude-cli|sdk] [--json]
allowed-tools: Bash
---

Run an on-demand Claude review of the supplied Codex response text. Uses the
same `stop-review-gate.md` prompt and ALLOW/BLOCK contract as the automatic
Stop hook, but does not affect session state. Intended for spot-checks or for
reviewing a prior turn.

```
node ${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs review $ARGUMENTS
```

Render the verdict block. If BLOCK, present the critique so the user can
decide how to act.
