---
name: claude-result-handling
description: How to present Claude Review output back to the user in the Codex TUI. Activates whenever a claude-companion.mjs invocation has returned and you need to turn its JSON into something the user can act on. Use when rendering ALLOW/BLOCK verdicts, adversarial-review findings, tracked-job summaries, or rescue results.
---

# Claude result handling (internal)

This skill governs how you turn `claude-companion.mjs` output into a
user-facing response. Keep output tight and actionable — the user is in a
terminal, not reading a report.

## General rules

1. **Never echo secrets.** The companion already redacts, but if you stitch
   strings together, keep any pasted `rawOutput` inside a fenced code block
   so accidental token-looking strings render as-is, not as links.
2. **Lead with the verdict**, not with prose. The user's next action depends
   on ALLOW vs BLOCK vs ERROR.
3. **Prefer lists over paragraphs** when there are multiple findings.
4. **Do not re-justify Claude's critique in your own words.** If the user
   wants more detail, they'll ask. Relay Claude's text verbatim.
5. **Preserve file:line citations.** If Claude mentions `src/foo.ts:42`,
   keep that format so the user can click it.

## Shapes and rendering

### `task` return (rescue subagent)

```jsonc
{
  "jobId": "job_...",
  "rawOutput": "...",
  "verdict": "allow | block | error",
  "reason": "...",
  "transportUsed": "claude-cli",
  "latencyMs": 2345
}
```

Render as:

```
Claude (claude-cli, 2.3s, job_ABCD...):

<rawOutput verbatim>

→ /claude-review:status to see tracked jobs
→ /claude-review:result --job job_ABCD... to re-fetch
```

If `verdict === "error"`: prefix the block with a one-line explanation
("Claude failed with: <reason>") and suggest `/claude-review:setup`.

### `review` return (one-shot)

- ALLOW → single line: `✅ ALLOW: <reason>`. No body needed.
- BLOCK → heading `🛑 BLOCK` followed by the full `reason` indented.
- ERROR → `⚠ review failed: <reason>`; don't fail the user's task.

### `adversarial-review` return

```jsonc
{
  "ok": true,
  "result": {
    "verdict": "block",
    "summary": "...",
    "findings": [
      { "severity": "high", "title": "...", "detail": "...", "file": "src/x.ts", "line_start": 42, "confidence": 0.9, "suggestion": "..." }
    ],
    "next_action": "..."
  }
}
```

Render as a compact table grouped by severity (critical → info), with
`file:line` as the second column. Include `suggestion` indented under each
finding when present. Put `next_action` at the bottom as a single bolded
line so it's hard to miss.

If `ok: false`: explain that Claude failed to produce schema-valid JSON,
surface the raw tail (last ~500 chars), and suggest rerunning with a
different model or `--transport sdk` (which enforces schema via tool-use).

### `status` return

Two sections — `last review` and `jobs`. Render jobs as a short table:

```
ID         KIND    STATUS    AGE
job_ABCD   task    running   12s
job_EFGH   review  done      3m
```

### `result` return

Dump the stored JSON in a fenced `json` block. The user invoked `/result`
deliberately; do not attempt to summarize.

## Error presentation

- Pipe-red the error line but keep the body plain. The user reads in a
  terminal; heavy ANSI in the body is annoying.
- If `/setup` suggestion is warranted, make it a literal clickable-style
  backtick line the user can copy.

## What you do NOT render

- Internal `latencyMs` / `tokensIn/Out` — omit unless user asks for metrics.
- Full `raw` content for errors longer than ~2000 chars — truncate with
  `[...N chars truncated]`.
- Claude's chain-of-thought if the transport happens to surface it.
