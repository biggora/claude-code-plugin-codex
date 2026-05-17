import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { log } from "./log.mjs";
import { redact } from "./redact.mjs";

export const CODEX_EVENT = Object.freeze({
  THREAD_STARTED: "thread.started",
  TURN_STARTED: "turn.started",
  TURN_COMPLETED: "turn.completed",
  ITEM_STARTED: "item.started",
  ITEM_COMPLETED: "item.completed",
  ITEM_UPDATED: "item.updated",
  ERROR: "error",
});

export async function* runCodexExec({ prompt, resume, sessionId, cwd, sandbox = "workspace-write", approval = "never", extraFlags = [], timeoutMs = null, signal }) {
  const baseArgs = ["exec"];
  if (resume) {
    if (sessionId) {
      baseArgs.push("resume", sessionId);
    } else {
      baseArgs.push("resume", "--last");
    }
  }
  baseArgs.push("--json", "--sandbox", sandbox, "--ask-for-approval", approval, ...extraFlags);
  if (prompt) baseArgs.push(prompt);

  const child = spawn("codex", baseArgs, {
    cwd,
    env: buildCodexChildEnv(process.env),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  yield { type: "spawn", pid: child.pid, args: baseArgs };

  const abort = () => {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  };
  if (signal) signal.addEventListener("abort", abort, { once: true });
  const timer = timeoutMs
    ? setTimeout(() => {
        abort();
      }, timeoutMs)
    : null;

  const stderrChunks = [];
  child.stderr.on("data", (c) => stderrChunks.push(c));

  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const queue = [];
  let resolveNext;
  let waiting = false;
  let closed = false;
  let exitCode = null;

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch (err) {
      event = { type: "parse-error", raw: trimmed, error: redact(err?.message ?? "") };
    }
    queue.push(event);
    if (waiting && resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      waiting = false;
      r();
    }
  });
  child.on("close", (code) => {
    exitCode = code;
    closed = true;
    if (waiting && resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      waiting = false;
      r();
    }
  });
  child.on("error", (err) => {
    log.warn("codex exec spawn error", { err: redact(err?.message ?? "") });
    queue.push({ type: CODEX_EVENT.ERROR, error: redact(err?.message ?? "") });
    closed = true;
    exitCode = exitCode ?? -1;
    if (waiting && resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      waiting = false;
      r();
    }
  });

  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift();
        continue;
      }
      if (closed) break;
      await new Promise((resolve) => {
        waiting = true;
        resolveNext = resolve;
      });
    }
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abort);
  }

  yield {
    type: "exit",
    exitCode,
    stderr: Buffer.concat(stderrChunks).toString("utf8").slice(-4000),
  };
}

export function buildCodexChildEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (upper.startsWith("ANTHROPIC_")) {
      delete env[key];
      continue;
    }
    if (
      upper.startsWith("CLAUDE_") &&
      /(KEY|TOKEN|SECRET|AUTH|CREDENTIAL|PASSWORD)/.test(upper)
    ) {
      delete env[key];
    }
  }
  return env;
}

export async function collectTurn(generator) {
  let sessionId = null;
  let lastAssistantMessage = null;
  let exitCode = null;
  const items = [];
  for await (const ev of generator) {
    if (!ev || typeof ev !== "object") continue;
    switch (ev.type) {
      case CODEX_EVENT.THREAD_STARTED:
        sessionId = ev.session_id ?? ev.sessionId ?? ev.thread_id ?? sessionId;
        break;
      case CODEX_EVENT.ITEM_COMPLETED:
      case CODEX_EVENT.ITEM_STARTED:
      case CODEX_EVENT.ITEM_UPDATED:
        items.push(ev);
        break;
      case CODEX_EVENT.TURN_COMPLETED:
        lastAssistantMessage = ev.last_assistant_message ?? ev.lastAssistantMessage ?? extractAssistantText(items) ?? lastAssistantMessage;
        break;
      case "exit":
        exitCode = ev.exitCode ?? null;
        break;
      default:
        break;
    }
  }
  if (!lastAssistantMessage) lastAssistantMessage = extractAssistantText(items);
  return { sessionId, lastAssistantMessage, items, exitCode };
}

function extractAssistantText(items) {
  const texts = [];
  for (const it of items) {
    const payload = it.item ?? it;
    if (!payload || typeof payload !== "object") continue;
    if (payload.role && payload.role !== "assistant") continue;
    if (typeof payload.text === "string") texts.push(payload.text);
    else if (typeof payload.content === "string") texts.push(payload.content);
    else if (Array.isArray(payload.content)) {
      for (const c of payload.content) {
        if (typeof c === "string") texts.push(c);
        else if (c?.text) texts.push(c.text);
      }
    }
  }
  return texts.join("\n") || null;
}
