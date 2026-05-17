#!/usr/bin/env node
import { parseArgs } from "./lib/args.mjs";
import { collectTurn, CODEX_EVENT, runCodexExec } from "./lib/codex-exec.mjs";
import { finishJob, registerJob } from "./lib/job-control.mjs";
import { workspaceKeyFor } from "./lib/paths.mjs";
import { redact } from "./lib/redact.mjs";
import { color, renderReviewBlock } from "./lib/render.mjs";
import { reviewStopPayload, VERDICT_ALLOW, VERDICT_BLOCK, VERDICT_SKIP } from "./lib/review.mjs";
import { readState } from "./lib/state.mjs";

const HELP = `codex-with-claude — run Codex with a post-turn Claude review

Usage:
  codex-with-claude "<prompt>" [flags]

Flags:
  --sandbox <mode>        read-only | workspace-write | danger-full-access
                          (default: workspace-write)
  --approval <policy>     untrusted | on-request | never (default: never)
  --max-iterations N      max review→resume rounds (default: 3)
  --no-review             skip Claude review entirely
  --model <id>            override reviewer model
  --transport <t>         auto | claude-cli | sdk
  --resume <session_id>   continue a specific Codex session
  --json                  emit one JSON line per event instead of rendered text
`;

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    process.stdout.write(HELP);
    return;
  }

  const { flags, positional } = parseArgs(argv, {
    booleans: ["no-review", "json"],
    strings: ["sandbox", "approval", "max-iterations", "model", "transport", "resume"],
  });
  const prompt = positional.join(" ").trim();
  if (!prompt) throw new Error("Provide a prompt as the positional argument");

  const sandbox = flags.sandbox ?? "workspace-write";
  const approval = flags.approval ?? "never";
  const maxIterations = parsePositiveInteger(flags["max-iterations"] ?? "3", "--max-iterations");
  const key = workspaceKeyFor(process.cwd());

  let currentPrompt = prompt;
  let sessionId = flags.resume ?? null;
  let iteration = 0;

  while (true) {
    iteration++;
    process.stderr.write(color.bold(`\n▶ Codex iteration ${iteration}\n`));

    const job = registerJob(key, {
      kind: "codex-exec",
      command: `codex exec ${sessionId ? `resume ${sessionId} ` : ""}`,
      pid: process.pid,
      meta: { iteration, sandbox, approval },
    });

    const gen = runCodexExec({
      prompt: currentPrompt,
      sessionId,
      resume: Boolean(sessionId),
      cwd: process.cwd(),
      sandbox,
      approval,
    });

    const tapped = tapEvents(gen, { json: flags.json });
    const turn = await collectTurn(tapped);
    sessionId = turn.sessionId ?? sessionId;
    finishJob(key, job.id, { exitCode: turn.exitCode ?? 0 });

    if (!turn.lastAssistantMessage) {
      process.stderr.write(color.yellow("Codex produced no assistant message; exiting.\n"));
      process.exit(turn.exitCode ?? 0);
    }

    if (flags["no-review"]) {
      process.exit(turn.exitCode ?? 0);
    }

    const state = readState(key);
    const overrideConfig = {
      reviewGate: true,
      model: flags.model ?? state.config.model ?? "claude-opus-4-7",
      transport: flags.transport ?? state.config.transport ?? "auto",
    };

    process.stderr.write(color.bold("\n▶ Claude review\n"));
    const result = await reviewStopPayload(
      {
        cwd: process.cwd(),
        stop_hook_active: false,
        last_assistant_message: turn.lastAssistantMessage,
      },
      { overrideConfig },
    );

    process.stderr.write(renderReviewBlock(result) + "\n");

    if (result.verdict === VERDICT_ALLOW || result.verdict === VERDICT_SKIP) {
      process.exit(turn.exitCode ?? 0);
    }
    if (result.verdict !== VERDICT_BLOCK) {
      process.stderr.write(color.yellow("Review error — exiting without further iterations.\n"));
      process.exit(turn.exitCode ?? 0);
    }

    if (iteration >= maxIterations) {
      process.stderr.write(
        color.red(`Review still blocking after ${iteration} iteration(s); stopping.\n`),
      );
      process.exit(2);
    }

    currentPrompt = result.reason;
  }
}

function parsePositiveInteger(value, flagName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${flagName} must be an integer >= 1`);
  }
  return n;
}

async function* tapEvents(gen, { json }) {
  for await (const ev of gen) {
    if (json) {
      try {
        process.stdout.write(JSON.stringify(ev) + "\n");
      } catch {
        // ignore
      }
    } else if (ev?.type === CODEX_EVENT.TURN_COMPLETED) {
      process.stderr.write(color.dim("  [turn completed]\n"));
    } else if (ev?.type === "exit") {
      process.stderr.write(color.dim(`  [codex exited code=${ev.exitCode}]\n`));
    } else if (ev?.type === "spawn") {
      process.stderr.write(color.dim(`  [codex pid=${ev.pid}]\n`));
    } else if (ev?.type === CODEX_EVENT.ITEM_COMPLETED) {
      const payload = ev.item ?? ev;
      const text = payload.text ?? (typeof payload.content === "string" ? payload.content : null);
      if (text) process.stdout.write(text + "\n");
    }
    yield ev;
  }
}

main().catch((err) => {
  process.stderr.write(color.red("Fatal: ") + redact(err?.message ?? "unknown") + "\n");
  process.exit(1);
});
