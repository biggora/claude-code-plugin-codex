import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("state: roundtrip read/write with atomic rename", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "claude-review-state-"));
  process.env.CODEX_PLUGIN_DATA = tmp;
  try {
    const { readState, updateState, setConfig, defaultState } = await import(
      "../scripts/lib/state.mjs?test-" + Date.now()
    );
    const key = "abcdef1234567890";

    const initial = readState(key);
    assert.equal(initial.version, 1);
    assert.equal(initial.config.reviewGate, false);
    assert.equal(initial.config.model, "claude-opus-4-7");

    setConfig(key, "reviewGate", true);
    const after = readState(key);
    assert.equal(after.config.reviewGate, true);

    updateState(key, (s) => {
      s.lastReview = { verdict: "allow", reason: "test" };
      return s;
    });
    const latest = readState(key);
    assert.equal(latest.lastReview.verdict, "allow");
    assert.equal(latest.config.reviewGate, true);

    const fresh = defaultState();
    assert.equal(fresh.config.reviewGate, false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.CODEX_PLUGIN_DATA;
  }
});

test("state: corrupt file falls back to default", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "claude-review-corrupt-"));
  process.env.CODEX_PLUGIN_DATA = tmp;
  try {
    const { readState, writeState } = await import(
      "../scripts/lib/state.mjs?test-" + (Date.now() + 1)
    );
    const key = "deadbeefdeadbeef";
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const dir = join(tmp, "state", key);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "state.json"), "{ not valid json", "utf8");

    const state = readState(key);
    assert.equal(state.version, 1);
    assert.equal(state.config.reviewGate, false);

    writeState(key, { ...state, config: { ...state.config, reviewGate: true } });
    assert.equal(readState(key).config.reviewGate, true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.CODEX_PLUGIN_DATA;
  }
});
