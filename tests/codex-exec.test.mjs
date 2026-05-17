import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { buildCodexChildEnv, collectTurn, CODEX_EVENT } from "../scripts/lib/codex-exec.mjs";

async function* replayJsonl(path) {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    yield JSON.parse(trimmed);
  }
  yield { type: "exit", exitCode: 0 };
}

test("collectTurn: extracts sessionId and last_assistant_message", async () => {
  const path = fileURLToPath(new URL("./fixtures/codex-exec-jsonl/simple-turn.jsonl", import.meta.url));
  const gen = replayJsonl(path);
  const result = await collectTurn(gen);
  assert.equal(result.sessionId, "sess-abc-123");
  assert.match(result.lastAssistantMessage, /logic looks correct/);
  assert.equal(result.exitCode, 0);
});

test("collectTurn: synthesizes last message from items when turn.completed omits it", async () => {
  async function* gen() {
    yield { type: CODEX_EVENT.THREAD_STARTED, session_id: "s2" };
    yield { type: CODEX_EVENT.ITEM_COMPLETED, item: { role: "assistant", text: "Partial A" } };
    yield { type: CODEX_EVENT.ITEM_COMPLETED, item: { role: "assistant", text: "Partial B" } };
    yield { type: CODEX_EVENT.TURN_COMPLETED, turn_id: "t1" };
    yield { type: "exit", exitCode: 0 };
  }
  const result = await collectTurn(gen());
  assert.equal(result.sessionId, "s2");
  assert.match(result.lastAssistantMessage, /Partial A/);
  assert.match(result.lastAssistantMessage, /Partial B/);
});

test("collectTurn: handles tool / user items without conflating with assistant text", async () => {
  async function* gen() {
    yield { type: CODEX_EVENT.THREAD_STARTED, session_id: "s3" };
    yield { type: CODEX_EVENT.ITEM_COMPLETED, item: { role: "tool", text: "ran ls" } };
    yield { type: CODEX_EVENT.ITEM_COMPLETED, item: { role: "assistant", text: "Done." } };
    yield { type: CODEX_EVENT.TURN_COMPLETED };
    yield { type: "exit", exitCode: 0 };
  }
  const result = await collectTurn(gen());
  assert.equal(result.lastAssistantMessage?.trim(), "Done.");
});

test("buildCodexChildEnv: strips Claude and Anthropic credentials", () => {
  const env = buildCodexChildEnv({
    PATH: "keep",
    CODEX_HOME: "keep-too",
    ANTHROPIC_API_KEY: "secret",
    ANTHROPIC_AUTH_TOKEN: "secret",
    CLAUDE_SESSION_TOKEN: "secret",
    CLAUDE_PLUGIN_ROOT: "/plugin",
    CLAUDE_PLUGIN_DATA: "/data",
  });
  assert.equal(env.PATH, "keep");
  assert.equal(env.CODEX_HOME, "keep-too");
  assert.equal(env.CLAUDE_PLUGIN_ROOT, "/plugin");
  assert.equal(env.CLAUDE_PLUGIN_DATA, "/data");
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(env.CLAUDE_SESSION_TOKEN, undefined);
});
