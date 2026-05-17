---
description: Cancel a tracked Claude job (tree-kill) or every running job.
argument-hint: (--job <id> | --all) [--json]
---

Terminate a running Claude-side job. Uses `tree-kill` so descendant processes
are killed on both Unix and Windows.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") cancel $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" cancel $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.

Report per-job outcome: `cancelled`, `already-finished`, or the failure reason.
