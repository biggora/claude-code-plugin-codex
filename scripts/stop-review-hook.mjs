#!/usr/bin/env node
import { log } from "./lib/log.mjs";
import { redact } from "./lib/redact.mjs";
import {
  reviewStopPayload,
  VERDICT_ALLOW,
  VERDICT_BLOCK,
  VERDICT_SKIP,
  VERDICT_ERROR,
} from "./lib/review.mjs";

async function main() {
  let payload;
  try {
    payload = await readStdinJson();
  } catch (err) {
    log.warn("stop-hook: failed to parse stdin (fail-open)", { err: redact(err?.message ?? "") });
    process.exit(0);
    return;
  }

  if (!payload || typeof payload !== "object") {
    log.debug("stop-hook: empty or non-object payload, passing through");
    process.exit(0);
    return;
  }

  let result;
  try {
    result = await reviewStopPayload(payload);
  } catch (err) {
    log.warn("stop-hook: review threw (fail-open)", { err: redact(err?.message ?? "") });
    process.exit(0);
    return;
  }

  switch (result.verdict) {
    case VERDICT_SKIP:
      log.debug("stop-hook: skip", { reason: result.reason });
      process.exit(0);
      return;
    case VERDICT_ALLOW:
      log.info("stop-hook: ALLOW", { reason: result.reason?.slice(0, 200) });
      process.exit(0);
      return;
    case VERDICT_BLOCK: {
      const decision = {
        decision: "block",
        reason: result.reason ?? "Claude review requested changes.",
      };
      process.stdout.write(JSON.stringify(decision) + "\n");
      log.info("stop-hook: BLOCK", { headline: result.headline?.slice(0, 200) });
      process.exit(0);
      return;
    }
    case VERDICT_ERROR:
    default:
      log.warn("stop-hook: error verdict (fail-open)", {
        reason: result.reason,
        detail: result.detail?.slice?.(0, 200),
      });
      process.exit(0);
      return;
  }
}

function readStdinJson() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("error", (err) => reject(err));
    process.stdin.on("end", () => {
      const trimmed = data.trim();
      if (!trimmed) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(trimmed));
      } catch (err) {
        reject(err);
      }
    });
  });
}

main().catch((err) => {
  log.warn("stop-hook: unexpected crash (fail-open)", { err: redact(err?.message ?? "") });
  process.exit(0);
});
