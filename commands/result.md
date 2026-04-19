---
description: Dump the result payload for a tracked Claude job.
argument-hint: --job <id> [--json]
allowed-tools: Bash
---

Print the stored result for a specific job id (seen via `/claude-review:status`).
Useful for inspecting the full Claude response from a rescue / task / review
run after the fact.

```
node ${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs result $ARGUMENTS
```
