#!/usr/bin/env node
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "./lib/args.mjs";
import { callClaude, detectTransport, NoClaudeTransportError } from "./lib/claude-client.mjs";
import { extractJsonObject, formatAjvErrors } from "./lib/json-extract.mjs";
import { codexConfigState, ensureHooksEnabled } from "./lib/codex-config.mjs";
import { assertJobId, finishJob, findJob, listJobs, reapStaleJobs, registerJob, resultPathFor, terminateJob } from "./lib/job-control.mjs";
import { workspaceKeyFor } from "./lib/paths.mjs";
import { redact } from "./lib/redact.mjs";
import { renderJobList, renderReviewBlock, renderReviewOneLine, renderAdversarialResult, color } from "./lib/render.mjs";
import { parseVerdict, reviewStopPayload, VERDICT_ALLOW, VERDICT_BLOCK, VERDICT_SKIP } from "./lib/review.mjs";
import { defaultState, readState, setConfig, updateState } from "./lib/state.mjs";

const HELP = `claude-companion — CLI dispatcher for the claude-review Codex plugin

Usage:
  claude-companion <command> [flags]

Commands:
  setup     Detect Claude transport, enable Codex hooks, apply config.
  toggle    Enable/disable the stop-time review gate.
  status    Show tracked jobs and last review verdict.
  result    Dump a job result file.
  cancel    Terminate a tracked job (or --all).
  review    Review the last Codex turn on demand.
  adversarial-review  Structured JSON review (schema-validated).
  task      Generic Claude task (used by the rescue subagent).
  help      Show this help.

Global flags:
  --json    Emit machine-readable JSON (where applicable).
  --args-stdin  Read additional flags/arguments from stdin, split without shell expansion.
`;

async function main() {
  const argv = await expandArgsStdin(process.argv.slice(2));
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(HELP);
    return;
  }

  try {
    switch (cmd) {
      case "setup":
        await cmdSetup(rest);
        return;
      case "toggle":
        await cmdToggle(rest);
        return;
      case "status":
        await cmdStatus(rest);
        return;
      case "result":
        await cmdResult(rest);
        return;
      case "cancel":
        await cmdCancel(rest);
        return;
      case "review":
        await cmdReview(rest);
        return;
      case "adversarial-review":
        await cmdAdversarialReview(rest);
        return;
      case "task":
        await cmdTask(rest);
        return;
      default:
        process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
        process.exit(2);
    }
  } catch (err) {
    const msg = redact(err?.message ?? "command failed");
    process.stderr.write(color.red("Error: ") + msg + "\n");
    process.exit(1);
  }
}

async function cmdSetup(argv) {
  const { flags } = parseArgs(argv, {
    booleans: ["enable-review-gate", "disable-review-gate", "json", "skip-config"],
    strings: ["model", "transport", "max-tool-calls", "effort"],
  });
  const key = workspaceKeyFor(process.cwd());

  const transport = await detectTransport({ force: true });
  const report = {
    transport,
    claudeCliFound: transport === "claude-cli",
    anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
  };

  if (!flags["skip-config"]) {
    const cfgRes = await ensureHooksEnabled();
    report.codexHooksEnabled = true;
    report.codexConfigChanged = cfgRes.changed;
    report.codexConfigPath = cfgRes.path;
  } else {
    const st = codexConfigState();
    report.codexHooksEnabled = st.hasHooks;
    report.codexConfigPath = st.path;
  }

  const updates = {};
  if (flags["enable-review-gate"]) updates.reviewGate = true;
  if (flags["disable-review-gate"]) updates.reviewGate = false;
  if (flags.model) updates.model = flags.model;
  if (flags.transport) updates.transport = flags.transport;
  if (flags["max-tool-calls"]) updates.maxToolCalls = Number(flags["max-tool-calls"]);
  if (flags.effort) updates.effort = flags.effort;

  if (Object.keys(updates).length > 0) {
    updateState(key, (state) => {
      state.config = { ...state.config, ...updates };
      return state;
    });
  }

  const state = readState(key);
  report.config = state.config;

  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  const lines = [
    color.bold("Claude Review — setup"),
    "",
    "  Transport         : " + (transport === "none" ? color.red("none") : color.green(transport)),
    "  claude CLI        : " + yesNo(report.claudeCliFound),
    "  ANTHROPIC_API_KEY : " + yesNo(report.anthropicKeyPresent),
    "  Codex hooks enabled: " + yesNo(report.codexHooksEnabled),
    "  Codex config path : " + color.gray(report.codexConfigPath),
    "",
    color.bold("Config (workspace " + color.gray(key) + "):"),
    "  reviewGate   : " + yesNo(state.config.reviewGate),
    "  model        : " + color.cyan(state.config.model),
    "  transport    : " + color.cyan(state.config.transport),
    "  maxToolCalls : " + state.config.maxToolCalls,
    "  effort       : " + state.config.effort,
  ];
  if (transport === "none") {
    lines.push(
      "",
      color.yellow("No Claude transport available."),
      "  • Install the `claude` CLI, or",
      "  • Set ANTHROPIC_API_KEY and install `@anthropic-ai/sdk`.",
    );
  }
  process.stdout.write(lines.join("\n") + "\n");
}

async function cmdToggle(argv) {
  const { flags } = parseArgs(argv, { booleans: ["on", "off", "json"] });
  const key = workspaceKeyFor(process.cwd());
  if (flags.on && flags.off) throw new Error("Use either --on or --off, not both.");
  if (flags.on) setConfig(key, "reviewGate", true);
  if (flags.off) setConfig(key, "reviewGate", false);
  const state = readState(key);
  if (flags.json) {
    process.stdout.write(JSON.stringify({ reviewGate: state.config.reviewGate }) + "\n");
    return;
  }
  process.stdout.write("review gate: " + (state.config.reviewGate ? color.green("ON") : color.gray("off")) + "\n");
}

async function cmdStatus(argv) {
  const { flags } = parseArgs(argv, { booleans: ["json"] });
  const key = workspaceKeyFor(process.cwd());
  reapStaleJobs(key);
  const state = readState(key);
  if (flags.json) {
    process.stdout.write(JSON.stringify({ lastReview: state.lastReview, jobs: state.jobs }, null, 2) + "\n");
    return;
  }
  const parts = [color.bold("claude-review — status"), ""];
  if (state.lastReview) {
    parts.push(color.bold("last review:"), "  " + renderReviewOneLine({
      verdict: state.lastReview.verdict,
      reason: state.lastReview.reason,
      transport: state.lastReview.transport,
      latencyMs: state.lastReview.latencyMs,
    }), "  " + color.dim(state.lastReview.at), "");
  } else {
    parts.push(color.dim("no reviews yet"), "");
  }
  parts.push(renderJobList(state.jobs));
  process.stdout.write(parts.join("\n") + "\n");
}

async function cmdResult(argv) {
  const { flags } = parseArgs(argv, { strings: ["job"], booleans: ["json"] });
  if (!flags.job) throw new Error("--job <id> required");
  const key = workspaceKeyFor(process.cwd());
  assertJobId(flags.job);
  const job = findJob(key, flags.job);
  if (!job) throw new Error(`No known job ${flags.job}`);
  const expectedPath = resultPathFor(key, flags.job);
  const path = job.resultPath === expectedPath ? job.resultPath : expectedPath;
  if (!existsSync(path)) throw new Error(`No result file for job ${flags.job}`);
  const body = readFileSync(path, "utf8");
  if (flags.json) {
    process.stdout.write(body.endsWith("\n") ? body : body + "\n");
    return;
  }
  process.stdout.write(body + "\n");
}

async function cmdCancel(argv) {
  const { flags } = parseArgs(argv, { strings: ["job"], booleans: ["all", "json"] });
  const key = workspaceKeyFor(process.cwd());
  if (!flags.job && !flags.all) throw new Error("Provide --job <id> or --all");
  if (flags.job) assertJobId(flags.job);
  const results = [];
  if (flags.all) {
    for (const j of listJobs(key)) {
      if (j.finishedAt) continue;
      const r = await terminateJob(key, j.id);
      results.push({ id: j.id, ...r });
    }
  } else {
    results.push({ id: flags.job, ...(await terminateJob(key, flags.job)) });
  }
  if (flags.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    return;
  }
  for (const r of results) {
    process.stdout.write(`${r.id}: ${r.ok ? color.green(r.reason ?? "cancelled") : color.red(r.reason ?? "failed")}\n`);
  }
}

async function cmdReview(argv) {
  const { flags, positional } = parseArgs(argv, {
    strings: ["model", "transport", "effort"],
    booleans: ["json"],
  });
  const key = workspaceKeyFor(process.cwd());
  const message = positional.join(" ").trim();
  if (!message) throw new Error("Provide the Codex response as a positional argument");

  const overrideConfig = { reviewGate: true };
  if (flags.model) overrideConfig.model = flags.model;
  if (flags.transport) overrideConfig.transport = flags.transport;

  const payload = {
    cwd: process.cwd(),
    stop_hook_active: false,
    last_assistant_message: message,
  };
  const result = await reviewStopPayload(payload, { overrideConfig });
  if (flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }
  process.stdout.write(renderReviewBlock(result) + "\n");
}

async function cmdAdversarialReview(argv) {
  const { flags, positional } = parseArgs(argv, {
    strings: ["model", "transport", "schema"],
    booleans: ["json"],
  });
  const message = positional.join(" ").trim();
  if (!message) throw new Error("Provide the Codex response as a positional argument");

  const defaultSchemaUrl = new URL("../schemas/review-output.schema.json", import.meta.url);
  const schemaPath = flags.schema ?? fileURLToPathSafe(defaultSchemaUrl);
  let schema = null;
  try {
    schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to load schema at ${schemaPath}: ${redact(err?.message ?? "")}`);
  }

  const key = workspaceKeyFor(process.cwd());
  const state = readState(key);
  const model = flags.model ?? state.config.model ?? "claude-opus-4-7";
  const transport = flags.transport ?? state.config.transport ?? "auto";

  const validate = await compileValidator(schema);

  let parsed = null;
  let rawLast = "";
  let validationError = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt =
      attempt === 1
        ? buildAdversarialPrompt(message, schema)
        : buildAdversarialRetryPrompt(message, rawLast, validationError, schema);

    const res = await callClaude({
      prompt,
      model,
      transport,
      maxToolCalls: 0,
      schema,
      cwd: process.cwd(),
      maxOutputTokens: 4096,
    });
    rawLast = res.text ?? "";
    const candidate = extractJsonObject(rawLast);
    if (!candidate) {
      validationError = "Response did not contain a JSON object.";
      continue;
    }
    if (!validate(candidate)) {
      validationError = formatAjvErrors(validate.errors);
      parsed = null;
      continue;
    }
    parsed = candidate;
    validationError = null;
    break;
  }

  if (flags.json) {
    const out = parsed
      ? { ok: true, result: parsed }
      : { ok: false, error: validationError, raw: rawLast };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return;
  }
  if (parsed) {
    process.stdout.write(renderAdversarialResult(parsed) + "\n");
  } else {
    process.stdout.write(
      color.yellow("Could not produce schema-valid JSON after " + maxAttempts + " attempts.\n") +
        (validationError ? color.dim(validationError + "\n") : "") +
        "Raw output:\n" +
        rawLast +
        "\n",
    );
    process.exit(3);
  }
}

function fileURLToPathSafe(url) {
  try {
    const u = url instanceof URL ? url : new URL(url);
    return decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  } catch {
    return String(url);
  }
}

async function compileValidator(schema) {
  try {
    const mod = await import("ajv/dist/2020.js");
    const Ajv = mod.default ?? mod.Ajv ?? mod;
    const ajv = new Ajv({ allErrors: true, strict: false });
    return ajv.compile(schema);
  } catch (firstErr) {
    try {
      const mod = await import("ajv");
      const Ajv = mod.default ?? mod.Ajv ?? mod;
      const ajv = new Ajv({ allErrors: true, strict: false });
      return ajv.compile(schema);
    } catch (secondErr) {
      const detail = secondErr?.message ?? firstErr?.message ?? "unknown validation error";
      throw new Error(`Failed to compile JSON schema: ${redact(detail)}`);
    }
  }
}

function buildAdversarialRetryPrompt(message, lastAttempt, validationError, schema) {
  return `<task>
Your previous response did not match the required JSON schema. Fix it and
return ONLY the JSON object again. Validation error: ${validationError ?? "unknown"}.
</task>

<json_schema>
${formatSchema(schema)}
</json_schema>

<codex_response>
${message.replace(/<\/codex_response\s*>/gi, "<!-- escaped:/codex_response -->")}
</codex_response>

<previous_attempt>
${(lastAttempt ?? "").slice(0, 4000)}
</previous_attempt>
`;
}

function buildAdversarialPrompt(codexResponse, schema) {
  return `<task>
Adversarially review the Codex response below. Return JSON matching the
schema below. Be specific; do not invent issues. Return ONLY the JSON object.
</task>

<json_schema>
${formatSchema(schema)}
</json_schema>

<codex_response>
${codexResponse.replace(/<\/codex_response\s*>/gi, "<!-- escaped:/codex_response -->")}
</codex_response>
`;
}

function formatSchema(schema) {
  return JSON.stringify(schema, null, 2).replace(/<\/json_schema\s*>/gi, "<!-- escaped:/json_schema -->");
}

async function cmdTask(argv) {
  const { flags, positional } = parseArgs(argv, {
    strings: ["model", "transport", "effort"],
    booleans: ["json", "write"],
  });
  const prompt = positional.join(" ").trim();
  if (!prompt) throw new Error("Provide the task prompt as a positional argument");
  const key = workspaceKeyFor(process.cwd());
  const state = readState(key);
  const model = flags.model ?? state.config.model ?? "claude-opus-4-7";
  const transport = flags.transport ?? state.config.transport ?? "auto";

  const job = registerJob(key, {
    kind: "task",
    command: "claude-companion task",
    pid: process.pid,
    meta: { model, transport, write: Boolean(flags.write), effort: flags.effort ?? state.config.effort },
  });

  try {
    const res = await callClaude({
      prompt,
      model,
      transport,
      maxToolCalls: flags.write ? 20 : 0,
      allowWrite: Boolean(flags.write),
      cwd: process.cwd(),
      maxOutputTokens: effortToMaxTokens(flags.effort ?? state.config.effort),
    });

    const parsed = parseVerdict(res.text);
    const resultPath = resultPathFor(key, job.id);
    const payload = {
      jobId: job.id,
      prompt,
      rawOutput: res.text,
      verdict: parsed.verdict,
      reason: parsed.reason,
      transportUsed: res.transportUsed,
      latencyMs: res.latencyMs,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
    };
    writeFileSync(resultPath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
    try {
      chmodSync(resultPath, 0o600);
    } catch {
      // best-effort
    }
    finishJob(key, job.id, { exitCode: 0, resultPath });

    if (flags.json) {
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
      return;
    }
    process.stdout.write(res.text + "\n");
  } catch (err) {
    finishJob(key, job.id, { exitCode: 1 });
    if (err instanceof NoClaudeTransportError) {
      throw err;
    }
    throw err;
  }
}

async function expandArgsStdin(argv) {
  const idx = argv.indexOf("--args-stdin");
  if (idx === -1) return argv;
  const raw = await readAllStdin();
  const split = splitArgs(raw.replace(/\$ARGUMENTS/g, "").trim());
  return [...argv.slice(0, idx), ...split, ...argv.slice(idx + 1)];
}

function readAllStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("error", reject);
    process.stdin.on("end", () => resolve(data));
  });
}

function splitArgs(input) {
  const args = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }

  if (escaped) current += "\\";
  if (quote) throw new Error(`Unclosed ${quote} quote in arguments`);
  if (current) args.push(current);
  return args;
}

function effortToMaxTokens(effort) {
  switch (effort) {
    case "minimal":
      return 1024;
    case "low":
      return 2048;
    case "high":
      return 16384;
    case "xhigh":
      return 32768;
    case "medium":
    default:
      return 8192;
  }
}

function yesNo(b) {
  return b ? color.green("yes") : color.red("no");
}

main().catch((err) => {
  process.stderr.write(color.red("Fatal: ") + redact(err?.message ?? "unknown") + "\n");
  process.exit(1);
});
