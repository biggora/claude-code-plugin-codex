---
description: Detect Claude transport, enable Codex hooks, configure the review gate.
argument-hint: [--enable-review-gate | --disable-review-gate] [--model <id>] [--transport auto|claude-cli|sdk] [--max-tool-calls N] [--effort minimal|low|medium|high] [--skip-config] [--json]
allowed-tools: Bash
---

Run the setup wizard for the `claude-review` plugin. It verifies a Claude
transport is available (the `claude` CLI or `ANTHROPIC_API_KEY` + Anthropic
SDK), enables `[features] hooks = true` and `plugin_hooks = true` in
`~/.codex/config.toml` (with a timestamped backup), and persists review-gate configuration in the
per-workspace state file.

Invoke the companion script:

```
PLUGIN_ROOT="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}"
node "$PLUGIN_ROOT/scripts/claude-companion.mjs" setup --args-stdin <<'CLAUDE_REVIEW_ARGS'
$ARGUMENTS
CLAUDE_REVIEW_ARGS
```

Report the output verbatim. If transport is `none`, instruct the user to
either install the `claude` CLI or set `ANTHROPIC_API_KEY`.
