---
description: One-shot Claude review of a Codex response (without the Stop hook).
argument-hint: "<codex response to review>" [--model <id>] [--transport auto|claude-cli|sdk] [--json]
---

Run an on-demand Claude review of the supplied Codex response text. Uses the
same `stop-review-gate.md` prompt and ALLOW/BLOCK contract as the automatic
Stop hook, but does not affect session state. Intended for spot-checks or for
reviewing a prior turn.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") review $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" review $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.

Render the verdict block. If BLOCK, present the critique so the user can
decide how to act.
