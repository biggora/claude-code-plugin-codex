---
description: Delegate a hard task or a rewrite to Claude via the claude-rescue subagent.
argument-hint: "<task prompt>" [--fresh | --resume <session_id>] [--effort minimal|low|medium|high|xhigh] [--model <id>] [--write]
allowed-tools: Task
---

When Codex is stuck, when the user explicitly asks for a "second opinion",
or when a review verdict demands a rewrite Codex cannot produce, hand off to
Claude. The `claude-rescue` subagent wraps a single call to:

```
node ${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs task --json $ARGUMENTS
```

Defaults:
- `--write` is OFF (review-only Claude). Pass `--write` to let Claude edit
  files (tool-use enabled).
- Model inherits from workspace config (default `claude-opus-4-7`).

Render Claude's response verbatim; then summarize the files changed or the
diagnosis produced.
