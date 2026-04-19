import { test } from "node:test";
import { strict as assert } from "node:assert";

test("claude-client: detectTransport returns one of claude-cli/sdk/none", async () => {
  const { detectTransport } = await import("../scripts/lib/claude-client.mjs?t=" + Date.now());
  const t = await detectTransport({ force: true });
  assert.ok(["claude-cli", "sdk", "none"].includes(t), `got: ${t}`);
});

test("claude-client: NoClaudeTransportError thrown when transport=none and no fallback", async () => {
  const { callClaude, NoClaudeTransportError } = await import(
    "../scripts/lib/claude-client.mjs?t=" + (Date.now() + 1)
  );
  await assert.rejects(
    () =>
      callClaude({
        prompt: "hi",
        model: "claude-opus-4-7",
        transport: "none",
        timeoutMs: 1000,
      }),
    (err) => err instanceof NoClaudeTransportError,
  );
});
