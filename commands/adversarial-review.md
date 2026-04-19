---
description: Structured JSON review validated against review-output.schema.json.
argument-hint: "<codex response to review>" [--model <id>] [--transport auto|claude-cli|sdk] [--schema <path>] [--json]
allowed-tools: Bash
---

Invoke Claude in adversarial-review mode: Claude must emit JSON matching
`schemas/review-output.schema.json` (verdict, summary, findings with severity
and confidence, next_action). Schema enforcement happens via tool-use when
the SDK transport is active, or via Ajv post-validation otherwise.

```
node ${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs adversarial-review $ARGUMENTS
```

Render the findings table (severity, file:line, confidence, detail,
suggestion). If the output cannot be parsed as JSON, surface the raw text and
recommend retrying.
