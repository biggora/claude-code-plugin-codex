---
description: Dump the result payload for a tracked Claude job.
argument-hint: --job <id> [--json]
---

Print the stored result for a specific job id (seen via `/claude-review:status`).
Useful for inspecting the full Claude response from a rescue / task / review
run after the fact.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") result $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" result $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.
