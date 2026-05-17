import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const COMPANION = fileURLToPath(new URL("../scripts/claude-companion.mjs", import.meta.url));

function runCompanion(args, env = {}, input = undefined) {
  return spawnSync("node", [COMPANION, ...args], {
    env: { ...process.env, NO_COLOR: "1", ...env },
    input,
    encoding: "utf8",
  });
}

test("companion: help command", () => {
  const r = runCompanion(["help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /claude-companion/);
  assert.match(r.stdout, /Commands:/);
});

test("companion: unknown command exits 2", () => {
  const r = runCompanion(["not-a-command"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown command/);
});

test("companion: toggle --on then --off roundtrip (JSON)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-cp-"));
  try {
    const env = { CODEX_PLUGIN_DATA: tmp };
    const on = runCompanion(["toggle", "--on", "--json"], env);
    assert.equal(on.status, 0, on.stderr);
    assert.deepEqual(JSON.parse(on.stdout.trim()), { reviewGate: true });

    const off = runCompanion(["toggle", "--off", "--json"], env);
    assert.equal(off.status, 0, off.stderr);
    assert.deepEqual(JSON.parse(off.stdout.trim()), { reviewGate: false });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("companion: status --json emits lastReview/jobs shape", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-status-"));
  try {
    const r = runCompanion(["status", "--json"], { CODEX_PLUGIN_DATA: tmp });
    assert.equal(r.status, 0, r.stderr);
    const parsed = JSON.parse(r.stdout.trim());
    assert.ok(Object.prototype.hasOwnProperty.call(parsed, "lastReview"));
    assert.ok(Array.isArray(parsed.jobs));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("companion: setup --skip-config + --json surfaces transport and config", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-setup-"));
  try {
    const r = runCompanion(
      ["setup", "--skip-config", "--enable-review-gate", "--model", "claude-opus-4-7", "--json"],
      { CODEX_PLUGIN_DATA: tmp, ANTHROPIC_API_KEY: "" },
    );
    assert.equal(r.status, 0, r.stderr);
    const parsed = JSON.parse(r.stdout.trim());
    assert.ok(["auto", "claude-cli", "sdk", "none"].includes(parsed.transport) || parsed.transport);
    assert.equal(parsed.config.reviewGate, true);
    assert.equal(parsed.config.model, "claude-opus-4-7");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("companion: result with missing job id errors clearly", () => {
  const r = runCompanion(["result"], { CODEX_PLUGIN_DATA: mkdtempSync(join(tmpdir(), "cr-result-")) });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--job/);
});

test("companion: result rejects invalid job id before file access", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-result-invalid-"));
  try {
    const r = runCompanion(["result", "--job", "..\\state"], { CODEX_PLUGIN_DATA: tmp });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Invalid job id/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("companion: --args-stdin expands command arguments without shell execution", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-stdin-"));
  try {
    const r = runCompanion(["toggle", "--args-stdin"], { CODEX_PLUGIN_DATA: tmp }, "--on --json");
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout.trim()), { reviewGate: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
