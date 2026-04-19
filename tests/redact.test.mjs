import { test } from "node:test";
import { strict as assert } from "node:assert";
import { redact, redactError } from "../scripts/lib/redact.mjs";

test("redact: hides sk-ant-* tokens", () => {
  const dirty = "api key is sk-ant-abcdefghijklmnopqrstuvwxyz and that is it";
  assert.doesNotMatch(redact(dirty), /sk-ant-/);
  assert.match(redact(dirty), /\*\*\*/);
});

test("redact: hides ANTHROPIC_API_KEY=...", () => {
  const dirty = "env: ANTHROPIC_API_KEY=sk-ant-verysecretlongtoken1234567890";
  assert.doesNotMatch(redact(dirty), /verysecret/);
});

test("redact: hides Bearer tokens", () => {
  const dirty = "Authorization: Bearer abc123def456ghi789jkl012";
  assert.doesNotMatch(redact(dirty), /abc123def456ghi789/);
});

test("redact: passes through clean strings", () => {
  assert.equal(redact("nothing sensitive here"), "nothing sensitive here");
});

test("redactError: wraps error with redacted message", () => {
  const original = new Error("failed with sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ123");
  const redacted = redactError(original);
  assert.doesNotMatch(redacted.message, /sk-ant-/);
  assert.match(redacted.message, /\*\*\*/);
});

test("redactError: null-safe", () => {
  assert.equal(redactError(null), null);
});
