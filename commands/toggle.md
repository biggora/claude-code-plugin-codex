---
description: Turn the stop-time review gate on or off for this workspace.
argument-hint: --on | --off
allowed-tools: Bash
---

Toggle the Claude review gate for the current workspace. When ON, every Codex
`Stop` event triggers a Claude review that may BLOCK the turn and send
actionable critique back to Codex.

```
PLUGIN_ROOT="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}"
node "$PLUGIN_ROOT/scripts/claude-companion.mjs" toggle --args-stdin <<'CLAUDE_REVIEW_ARGS'
$ARGUMENTS
CLAUDE_REVIEW_ARGS
```

Echo the resulting status.
