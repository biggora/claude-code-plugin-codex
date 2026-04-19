import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseVerdict, VERDICT_ALLOW, VERDICT_BLOCK, VERDICT_ERROR, reviewStopPayload, VERDICT_SKIP } from "../scripts/lib/review.mjs";

test("parseVerdict: ALLOW prefix", () => {
  const r = parseVerdict("ALLOW: looks good");
  assert.equal(r.verdict, VERDICT_ALLOW);
  assert.equal(r.reason, "looks good");
});

test("parseVerdict: BLOCK multi-line", () => {
  const r = parseVerdict("BLOCK: missing test\nAdd a test for the error path.\nUse jest.fn().");
  assert.equal(r.verdict, VERDICT_BLOCK);
  assert.match(r.reason, /missing test/);
  assert.match(r.reason, /error path/);
});

test("parseVerdict: case-insensitive and whitespace tolerant", () => {
  assert.equal(parseVerdict("  allow: yes").verdict, VERDICT_ALLOW);
  assert.equal(parseVerdict("\n\nBlock:nope").verdict, VERDICT_BLOCK);
});

test("parseVerdict: malformed → error verdict", () => {
  assert.equal(parseVerdict("Hello, I think...").verdict, VERDICT_ERROR);
  assert.equal(parseVerdict("").verdict, VERDICT_ERROR);
  assert.equal(parseVerdict(null).verdict, VERDICT_ERROR);
});

test("reviewStopPayload: skips when reviewGate is off", async () => {
  const r = await reviewStopPayload(
    {
      cwd: process.cwd(),
      stop_hook_active: false,
      last_assistant_message: "I wrote some code",
    },
    { overrideConfig: { reviewGate: false } },
  );
  assert.equal(r.verdict, VERDICT_SKIP);
  assert.match(r.reason, /disabled/);
});

test("reviewStopPayload: skips when stop_hook_active=true (anti-loop)", async () => {
  const r = await reviewStopPayload(
    {
      cwd: process.cwd(),
      stop_hook_active: true,
      last_assistant_message: "Second pass",
    },
    { overrideConfig: { reviewGate: true } },
  );
  assert.equal(r.verdict, VERDICT_SKIP);
  assert.equal(r.reason, "stop_hook_active");
});

test("reviewStopPayload: skips when last message empty", async () => {
  const r = await reviewStopPayload(
    {
      cwd: process.cwd(),
      stop_hook_active: false,
      last_assistant_message: "   ",
    },
    { overrideConfig: { reviewGate: true } },
  );
  assert.equal(r.verdict, VERDICT_SKIP);
});
