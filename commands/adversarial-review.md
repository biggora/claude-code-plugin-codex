---
description: Structured JSON review validated against review-output.schema.json.
argument-hint: "<codex response to review>" [--model <id>] [--transport auto|claude-cli|sdk] [--schema <path>] [--json]
---

Invoke Claude in adversarial-review mode: Claude must emit JSON matching
`schemas/review-output.schema.json` (verdict, summary, findings with severity
and confidence, next_action). Schema enforcement happens via tool-use when
the SDK transport is active, or via Ajv post-validation otherwise.

Resolve the plugin root from the `PLUGIN_ROOT` environment variable and invoke
the cross-platform command shim with the active shell syntax:

PowerShell:

```powershell
node (Join-Path $env:PLUGIN_ROOT "scripts/slash-command.mjs") adversarial-review $ARGUMENTS
```

POSIX:

```sh
node "$PLUGIN_ROOT/scripts/slash-command.mjs" adversarial-review $ARGUMENTS
```

Do not call `scripts/claude-companion.mjs` directly from this slash command;
the shim handles command dispatch consistently across platforms.

Render the findings table (severity, file:line, confidence, detail,
suggestion). If the output cannot be parsed as JSON, surface the raw text and
recommend retrying.
