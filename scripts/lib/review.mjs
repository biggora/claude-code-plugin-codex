import { callClaude, NoClaudeTransportError } from "./claude-client.mjs";
import { log } from "./log.mjs";
import { interpolate, loadPrompt, sanitizeCodexBlock } from "./prompts.mjs";
import { redact } from "./redact.mjs";
import { readState, updateState, defaultState } from "./state.mjs";
import { workspaceKeyFor } from "./paths.mjs";

export const VERDICT_ALLOW = "allow";
export const VERDICT_BLOCK = "block";
export const VERDICT_SKIP = "skip";
export const VERDICT_ERROR = "error";

export async function reviewStopPayload(payload, { overrideConfig } = {}) {
  const cwd = payload.cwd ?? process.cwd();
  const key = workspaceKeyFor(cwd);
  const state = overrideConfig
    ? { ...defaultState(), config: { ...defaultState().config, ...overrideConfig } }
    : readState(key);

  if (!state.config.reviewGate) {
    return { verdict: VERDICT_SKIP, reason: "review gate disabled" };
  }
  if (payload.stop_hook_active === true) {
    return { verdict: VERDICT_SKIP, reason: "stop_hook_active" };
  }
  const body = (payload.last_assistant_message ?? "").trim();
  if (!body) {
    return { verdict: VERDICT_SKIP, reason: "empty last_assistant_message" };
  }

  const template = loadPrompt("stop-review-gate.md");
  const prompt = interpolate(template, {
    CODEX_RESPONSE_BLOCK: sanitizeCodexBlock(payload.last_assistant_message),
    CWD: cwd,
  });

  try {
    const res = await callClaude({
      prompt,
      model: state.config.model ?? "claude-opus-4-7",
      maxToolCalls: state.config.maxToolCalls ?? 0,
      transport: state.config.transport ?? "auto",
      timeoutMs: 880_000,
      cwd,
      maxOutputTokens: 1024,
    });
    const parsed = parseVerdict(res.text);
    persistLastReview(key, parsed, res);
    return { ...parsed, transportUsed: res.transportUsed, latencyMs: res.latencyMs };
  } catch (err) {
    const errMsg = redact(err?.message ?? "claude call failed");
    log.warn("review call failed (fail-open)", { err: errMsg });
    if (err instanceof NoClaudeTransportError) {
      return { verdict: VERDICT_ERROR, reason: "no-transport", detail: errMsg };
    }
    return { verdict: VERDICT_ERROR, reason: "call-failed", detail: errMsg };
  }
}

export function parseVerdict(text) {
  if (!text || typeof text !== "string") {
    return { verdict: VERDICT_ERROR, reason: "empty response" };
  }
  const lines = text.split(/\r?\n/);
  let first = "";
  for (const line of lines) {
    if (line.trim().length > 0) {
      first = line.trim();
      break;
    }
  }
  const allowMatch = /^ALLOW\s*:\s*(.*)$/i.exec(first);
  if (allowMatch) {
    return { verdict: VERDICT_ALLOW, reason: allowMatch[1] ?? "", fullText: text };
  }
  const blockMatch = /^BLOCK\s*:\s*(.*)$/i.exec(first);
  if (blockMatch) {
    return { verdict: VERDICT_BLOCK, reason: text.trim(), headline: blockMatch[1] ?? "", fullText: text };
  }
  return { verdict: VERDICT_ERROR, reason: "malformed verdict", fullText: text };
}

function persistLastReview(workspaceKey, parsed, res) {
  try {
    updateState(workspaceKey, (state) => {
      state.lastReview = {
        at: new Date().toISOString(),
        verdict: parsed.verdict,
        reason: (parsed.reason ?? "").slice(0, 2000),
        latencyMs: res.latencyMs ?? null,
        transport: res.transportUsed ?? null,
      };
      return state;
    });
  } catch (err) {
    log.debug("persistLastReview failed", { err: redact(err?.message ?? "") });
  }
}
