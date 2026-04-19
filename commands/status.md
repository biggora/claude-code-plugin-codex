---
description: Show the last Claude review verdict and any tracked background jobs.
argument-hint: [--json]
allowed-tools: Bash
---

Print the plugin's current status for this workspace: the last review verdict
(ALLOW / BLOCK / SKIP) with timing and transport used, plus every tracked
background job (rescue / task / codex-exec) and its state.

```
node ${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs status $ARGUMENTS
```

Render the output as-is.
