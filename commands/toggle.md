---
description: Turn the stop-time review gate on or off for this workspace.
argument-hint: --on | --off
---

Toggle the Claude review gate for the current workspace. When ON, every Codex
`Stop` event triggers a Claude review that may BLOCK the turn and send
actionable critique back to Codex.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") toggle $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" toggle $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.

Echo the resulting status.
