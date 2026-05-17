---
description: Delegate a hard task or a rewrite to Claude via the claude-rescue subagent.
argument-hint: "<task prompt>" [--effort minimal|low|medium|high|xhigh] [--model <id>] [--write]
allowed-tools: Task
---

When Codex is stuck, when the user explicitly asks for a "second opinion",
or when a review verdict demands a rewrite Codex cannot produce, hand off to
Claude. The `claude-rescue` subagent wraps a single call to:

```
PLUGIN_ROOT="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}"
node "$PLUGIN_ROOT/scripts/claude-companion.mjs" task --json --args-stdin <<'CLAUDE_REVIEW_ARGS'
$ARGUMENTS
CLAUDE_REVIEW_ARGS
```

Defaults:
- `--write` is OFF (review-only Claude). Pass `--write` to let Claude edit
  files (tool-use enabled).
- Model inherits from workspace config (default `claude-opus-4-7`).

Render Claude's response verbatim; then summarize the files changed or the
diagnosis produced.
