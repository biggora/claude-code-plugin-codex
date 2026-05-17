#!/usr/bin/env node
import { reapStaleJobs } from "./lib/job-control.mjs";
import { log } from "./lib/log.mjs";
import { workspaceKeyFor } from "./lib/paths.mjs";
import { redact } from "./lib/redact.mjs";

async function main() {
  try {
    const payload = await readStdin();
    log.debug("session-lifecycle-hook: invoked", {
      event: payload?.hook_event_name,
      source: payload?.source,
    });
    const cwd = typeof payload?.cwd === "string" ? payload.cwd : process.cwd();
    reapStaleJobs(workspaceKeyFor(cwd), { sessionId: payload?.session_id });
  } catch (err) {
    log.debug("session-lifecycle-hook: non-fatal error", { err: redact(err?.message ?? "") });
  }
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => {
      const t = data.trim();
      if (!t) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(t));
      } catch {
        resolve(null);
      }
    });
  });
}

main().catch(() => process.exit(0));
