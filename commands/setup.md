---
description: Detect Claude transport, enable Codex hooks, configure the review gate.
argument-hint: [--enable-review-gate | --disable-review-gate] [--model <id>] [--transport auto|claude-cli|sdk] [--max-tool-calls N] [--effort minimal|low|medium|high] [--skip-config] [--json]
---

Run the setup wizard for the `claude-review` plugin. It verifies a Claude
transport is available (the `claude` CLI or `ANTHROPIC_API_KEY` + Anthropic
SDK), enables `[features] hooks = true` and `plugin_hooks = true` in
`~/.codex/config.toml` (with a timestamped backup), and persists review-gate configuration in the
per-workspace state file.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") setup $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" setup $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.

Report the output verbatim. If transport is `none`, instruct the user to
either install the `claude` CLI or set `ANTHROPIC_API_KEY`.
