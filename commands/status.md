---
description: Show the last Claude review verdict and any tracked background jobs.
argument-hint: [--json]
---

Print the plugin's current status for this workspace: the last review verdict
(ALLOW / BLOCK / SKIP) with timing and transport used, plus every tracked
background job (rescue / task / codex-exec) and its state.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") status $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" status $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.

Render the output as-is.
