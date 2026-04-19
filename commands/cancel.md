---
description: Cancel a tracked Claude job (tree-kill) or every running job.
argument-hint: (--job <id> | --all) [--json]
allowed-tools: Bash
---

Terminate a running Claude-side job. Uses `tree-kill` so descendant processes
are killed on both Unix and Windows.

```
node ${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs cancel $ARGUMENTS
```

Report per-job outcome: `cancelled`, `already-finished`, or the failure reason.
