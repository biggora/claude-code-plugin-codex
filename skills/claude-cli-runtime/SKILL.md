---
name: claude-cli-runtime
description: Internal contract for calling the claude-companion runtime from Codex. Activates whenever a Codex agent needs to delegate a task to Claude (rescue, review, adversarial-review) or interpret the JSON wire format returned by claude-companion.mjs. Use when the user mentions "ask Claude", "second opinion from Claude", "have Claude review this", or when the claude-rescue subagent is dispatched.
---

# Claude CLI Runtime (internal)

This skill describes how to invoke the `claude-companion.mjs` CLI that ships
with the `claude-review` plugin and how to consume its output. Treat it as an
internal implementation contract for the `claude-rescue` subagent and for any
Codex agent that decides to delegate work to Claude.

## Invocation

One Bash call, no shell features needed. Always pass `--json` so the return
is machine-readable.

```
node ${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs <subcommand> --json [flags] "<prompt or codex response>"
```

Subcommands you are likely to invoke:

| Subcommand | When | Key flags |
|---|---|---|
| `task` | Rescue / deep reasoning / rewrite | `--write`, `--model`, `--transport`, `--effort`, `--resume <id>`, `--fresh` |
| `review` | Spot-check a Codex response (ALLOW/BLOCK verdict) | `--model`, `--transport` |
| `adversarial-review` | Structured findings (schema-validated) | `--model`, `--schema <path>` |
| `status` | Inspect tracked jobs | — |
| `result` | Fetch stored job payload | `--job <id>` |
| `cancel` | Terminate a job tree | `--job <id>` or `--all` |

## Flag semantics

- `--write`: Enables file-mutating tools (`Read`/`Write`/`Edit`/`Bash`) on the
  Claude side. OFF by default — claude-review is a **reviewer** unless asked
  to act. Pass only when the user explicitly wants Claude to change files.
- `--model`: Overrides the workspace default (`claude-opus-4-7`). Valid IDs
  today: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`.
- `--transport`: `auto` (default) | `claude-cli` | `sdk`. Auto picks `claude`
  CLI first, `@anthropic-ai/sdk` second.
- `--effort`: `minimal | low | medium | high | xhigh`. Maps to output-token
  budget (1k / 2k / 8k / 16k / 32k).
- `--fresh` vs `--resume <id>`: Start a clean Claude conversation, or
  continue a specific tracked job by id.

## Return format

Every `--json` invocation emits a single JSON object on stdout. Shape for
`task`:

```jsonc
{
  "jobId": "job_01HXXXX",
  "prompt": "...",
  "rawOutput": "<full Claude response>",
  "verdict": "allow | block | error",
  "reason": "short headline / full critique",
  "transportUsed": "claude-cli | sdk",
  "latencyMs": 1234,
  "tokensIn": 1234,
  "tokensOut": 1234
}
```

Shape for `review`: `{verdict, reason, fullText?, transportUsed, latencyMs}`.

Shape for `adversarial-review`:
`{ok: true, result: {verdict, summary, findings, next_action}}` on success,
or `{ok: false, error, raw}` on schema-invalid output after 2 attempts.

`status` / `result` / `cancel` all emit the obvious shapes; see
`scripts/claude-companion.mjs` for the authoritative types.

## Decision tree

**Is the user's ask a review-of-existing-work question?**
→ Use `review` (quick verdict) or `adversarial-review` (detailed findings).

**Is the user stuck and asking for rewrite or deep help?**
→ Use `task` with `--effort high`, no `--write` unless they specifically say
"let Claude edit files". Pass the full context they gave you.

**Does the user want to tweak a prior Claude run?**
→ Use `task --resume <jobId>` (get id from `status`).

**Is the user asking about plugin state, not content?**
→ `status` / `result` / `cancel`. Do not route through Claude.

## Error handling

- Non-zero exit from the companion → redact the stderr (never print API
  keys), surface the error to the user, and offer `/claude-review:setup` as
  the likely fix if the error mentions transport/auth.
- `NoClaudeTransportError` → instruct the user to install `claude` CLI or
  set `ANTHROPIC_API_KEY`, then rerun setup.
- Hook timeouts are Codex's concern, not yours; don't retry reflexively.

## Do NOT

- Do not shell-interpolate user input into the prompt argument; rely on the
  host's `Bash` tool, which already passes `$ARGUMENTS` safely.
- Do not call `claude` CLI or `@anthropic-ai/sdk` directly — always go
  through the companion so jobs, state, and redaction are consistent.
- Do not summarize or paraphrase Claude's `rawOutput` when you dispatched a
  rescue; the user asked for Claude's voice.
