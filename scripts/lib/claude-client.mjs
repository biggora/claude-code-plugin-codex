import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { log } from "./log.mjs";
import { redact, redactError } from "./redact.mjs";

export class NoClaudeTransportError extends Error {
  constructor(message) {
    super(message);
    this.name = "NoClaudeTransportError";
  }
}

let transportCache = null;

export async function detectTransport({ force = false } = {}) {
  if (transportCache && !force) return transportCache;

  if (await hasClaudeCli()) {
    transportCache = "claude-cli";
    return transportCache;
  }
  if (await hasAnthropicSdk()) {
    transportCache = "sdk";
    return transportCache;
  }
  transportCache = "none";
  return transportCache;
}

async function hasClaudeCli() {
  try {
    const { code } = await runCapture(resolveClaudeCliCommand(), ["--version"], { timeoutMs: 3000 });
    return code === 0;
  } catch {
    return false;
  }
}

function resolveClaudeCliCommand() {
  if (process.platform !== "win32") return "claude";

  const npmGlobalExe = join(
    dirname(process.execPath),
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "bin",
    "claude.exe",
  );

  return existsSync(npmGlobalExe) ? npmGlobalExe : "claude";
}

async function hasAnthropicSdk() {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  try {
    await import("@anthropic-ai/sdk");
    return true;
  } catch {
    return false;
  }
}

export async function callClaude(options) {
  const {
    prompt,
    model = "claude-opus-4-7",
    maxToolCalls = 0,
    transport = "auto",
    timeoutMs = 880_000,
    cwd = process.cwd(),
    schema = null,
    system = null,
    maxOutputTokens = 4096,
    allowWrite = false,
    allowedTools = null,
  } = options;

  const chosen = transport === "auto" ? await detectTransport() : transport;

  if (chosen === "none") {
    throw new NoClaudeTransportError(
      "No Claude transport available. Install `claude` CLI or set ANTHROPIC_API_KEY.",
    );
  }

  const startedAt = Date.now();

  if (chosen === "claude-cli") {
    const result = await callViaCli({ prompt, model, maxToolCalls, timeoutMs, cwd, allowWrite, allowedTools });
    return { ...result, transportUsed: "claude-cli", latencyMs: Date.now() - startedAt };
  }

  if (chosen === "sdk") {
    if (allowWrite) {
      log.warn("sdk transport does not execute tools; --write is advisory only", {});
    }
    const result = await callViaSdk({ prompt, model, timeoutMs, schema, system, maxOutputTokens });
    return { ...result, transportUsed: "sdk", latencyMs: Date.now() - startedAt };
  }

  throw new NoClaudeTransportError(`Unknown transport: ${chosen}`);
}

async function callViaCli({ prompt, model, maxToolCalls, timeoutMs, cwd, allowWrite, allowedTools }) {
  const args = ["-p", "--output-format", "json", "--model", model];

  const turns = computeMaxTurns(maxToolCalls, allowWrite);
  if (turns != null) {
    args.push("--max-turns", String(turns));
  }

  const toolsList = resolveAllowedTools(allowWrite, allowedTools);
  if (toolsList && toolsList.length > 0) {
    args.push("--allowedTools", toolsList.join(","));
  } else if (!allowWrite) {
    args.push("--allowedTools", "none");
  }

  const { code, stdout, stderr } = await runCapture(resolveClaudeCliCommand(), args, {
    timeoutMs,
    cwd,
    stdin: prompt,
  });

  if (code !== 0) {
    throw new Error(`claude CLI exited with code ${code}: ${redact(stderr).slice(0, 500)}`);
  }

  const text = extractTextFromCliJson(stdout);
  return { text, raw: stdout, tokensIn: null, tokensOut: null };
}

function computeMaxTurns(maxToolCalls, allowWrite) {
  if (!allowWrite) return 1;
  if (typeof maxToolCalls !== "number" || maxToolCalls <= 0) return 20;
  return Math.max(1, maxToolCalls);
}

function resolveAllowedTools(allowWrite, allowedTools) {
  if (Array.isArray(allowedTools)) return allowedTools;
  if (allowWrite) return ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
  return null;
}

function extractTextFromCliJson(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (parsed?.result) return parsed.result;
    if (parsed?.text) return parsed.text;
    if (Array.isArray(parsed?.messages)) {
      const last = parsed.messages[parsed.messages.length - 1];
      if (last?.content) return contentToText(last.content);
    }
    if (parsed?.content) return contentToText(parsed.content);
    return JSON.stringify(parsed);
  } catch {
    return trimmed;
  }
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : p?.text ?? ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

async function callViaSdk({ prompt, model, timeoutMs, schema, system, maxOutputTokens }) {
  const sdk = await import("@anthropic-ai/sdk");
  const AnthropicCtor = sdk.default ?? sdk.Anthropic ?? sdk;
  const client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Claude SDK timeout")), timeoutMs);

  try {
    const body = {
      model,
      max_tokens: maxOutputTokens,
      messages: [{ role: "user", content: prompt }],
    };
    if (system) body.system = system;

    if (schema) {
      body.tools = [
        {
          name: "submit",
          description: "Submit the review verdict.",
          input_schema: schema,
        },
      ];
      body.tool_choice = { type: "tool", name: "submit" };
    }

    const response = await client.messages.create(body, { signal: controller.signal });
    const text = sdkResponseToText(response);
    return {
      text,
      raw: response,
      tokensIn: response?.usage?.input_tokens ?? null,
      tokensOut: response?.usage?.output_tokens ?? null,
    };
  } catch (err) {
    throw redactError(err);
  } finally {
    clearTimeout(timer);
  }
}

function sdkResponseToText(response) {
  if (!response?.content) return "";
  if (Array.isArray(response.content)) {
    for (const block of response.content) {
      if (block.type === "tool_use" && block.input != null) {
        try {
          return JSON.stringify(block.input);
        } catch {
          return String(block.input);
        }
      }
    }
    return response.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  return String(response.content);
}

function runCapture(cmd, args, { timeoutMs, cwd, stdin } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
    } catch (err) {
      resolve({ code: -1, stdout: "", stderr: redact(err?.message ?? "spawn failed") });
      return;
    }

    let stdout = "";
    let stderr = "";
    let done = false;

    const timer = timeoutMs
      ? setTimeout(() => {
          if (done) return;
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
          done = true;
          resolve({ code: -1, stdout, stderr: stderr + "\n[timeout]", timedOut: true });
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
    child.on("error", (err) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      log.debug("spawn error", { cmd, err: redact(err?.message ?? "") });
      resolve({ code: -1, stdout, stderr: redact(err?.message ?? "") });
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr });
    });

    if (stdin != null) {
      try {
        child.stdin.end(stdin);
      } catch {
        // ignore
      }
    } else {
      try {
        child.stdin.end();
      } catch {
        // ignore
      }
    }
  });
}
