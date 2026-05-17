---
description: Delegate a hard task or a rewrite to Claude via the claude-rescue subagent.
argument-hint: "<task prompt>" [--effort minimal|low|medium|high|xhigh] [--model <id>] [--write]
---

When Codex is stuck, when the user explicitly asks for a "second opinion",
or when a review verdict demands a rewrite Codex cannot produce, hand off to
Claude through the same companion task path used by the `claude-rescue`
subagent.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") rescue $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" rescue $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.

Defaults:
- `--write` is OFF (review-only Claude). Pass `--write` to let Claude edit
  files (tool-use enabled).
- Model inherits from workspace config (default `claude-opus-4-7`).

Render Claude's response verbatim; then summarize the files changed or the
diagnosis produced.
