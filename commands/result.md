---
description: Dump the result payload for a tracked Claude job.
argument-hint: --job <id> [--json]
allowed-tools: Bash
---

Print the stored result for a specific job id (seen via `/claude-review:status`).
Useful for inspecting the full Claude response from a rescue / task / review
run after the fact.

```
PLUGIN_ROOT="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}"
node "$PLUGIN_ROOT/scripts/claude-companion.mjs" result --args-stdin <<'CLAUDE_REVIEW_ARGS'
$ARGUMENTS
CLAUDE_REVIEW_ARGS
```
