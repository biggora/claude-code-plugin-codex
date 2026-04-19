import { appendFileSync } from "node:fs";
import { logFile } from "./paths.mjs";
import { redact } from "./redact.mjs";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const envLevel = (process.env.CLAUDE_REVIEW_LOG ?? "info").toLowerCase();
const threshold = LEVELS[envLevel] ?? LEVELS.info;

function emit(level, message, extra) {
  if ((LEVELS[level] ?? 0) < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: redact(message),
    ...(extra ? { extra: redactExtra(extra) } : {}),
  };
  const line = JSON.stringify(entry);
  try {
    process.stderr.write(line + "\n");
  } catch {
    // stderr broken — nothing to do
  }
  try {
    appendFileSync(logFile(), line + "\n");
  } catch {
    // filesystem unavailable — best-effort
  }
}

function redactExtra(obj) {
  try {
    return JSON.parse(redact(JSON.stringify(obj)));
  } catch {
    return { _unserializable: true };
  }
}

export const log = {
  debug: (msg, extra) => emit("debug", msg, extra),
  info: (msg, extra) => emit("info", msg, extra),
  warn: (msg, extra) => emit("warn", msg, extra),
  error: (msg, extra) => emit("error", msg, extra),
};
