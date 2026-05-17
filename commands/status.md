---
description: Show the last Claude review verdict and any tracked background jobs.
argument-hint: [--json]
allowed-tools: Bash
---

Print the plugin's current status for this workspace: the last review verdict
(ALLOW / BLOCK / SKIP) with timing and transport used, plus every tracked
background job (rescue / task / codex-exec) and its state.

```
PLUGIN_ROOT="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}"
node "$PLUGIN_ROOT/scripts/claude-companion.mjs" status --args-stdin <<'CLAUDE_REVIEW_ARGS'
$ARGUMENTS
CLAUDE_REVIEW_ARGS
```

Render the output as-is.
