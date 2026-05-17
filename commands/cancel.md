---
description: Cancel a tracked Claude job (tree-kill) or every running job.
argument-hint: (--job <id> | --all) [--json]
allowed-tools: Bash
---

Terminate a running Claude-side job. Uses `tree-kill` so descendant processes
are killed on both Unix and Windows.

```
PLUGIN_ROOT="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}"
node "$PLUGIN_ROOT/scripts/claude-companion.mjs" cancel --args-stdin <<'CLAUDE_REVIEW_ARGS'
$ARGUMENTS
CLAUDE_REVIEW_ARGS
```

Report per-job outcome: `cancelled`, `already-finished`, or the failure reason.
