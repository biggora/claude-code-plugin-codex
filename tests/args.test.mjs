import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseArgs } from "../scripts/lib/args.mjs";

test("parseArgs: boolean flag", () => {
  const { flags } = parseArgs(["--enable-review-gate"], { booleans: ["enable-review-gate"] });
  assert.equal(flags["enable-review-gate"], true);
});

test("parseArgs: string flag with space separator", () => {
  const { flags } = parseArgs(["--model", "claude-opus-4-7"], { strings: ["model"] });
  assert.equal(flags.model, "claude-opus-4-7");
});

test("parseArgs: string flag with equals", () => {
  const { flags } = parseArgs(["--model=claude-sonnet-4-6"], { strings: ["model"] });
  assert.equal(flags.model, "claude-sonnet-4-6");
});

test("parseArgs: positional args", () => {
  const { positional, flags } = parseArgs(["--write", "do the thing"], { booleans: ["write"] });
  assert.deepEqual(positional, ["do the thing"]);
  assert.equal(flags.write, true);
});

test("parseArgs: unknown flag rejected by default", () => {
  assert.throws(() => parseArgs(["--wat"], {}), /Unknown flag/);
});

test("parseArgs: string flag missing value throws", () => {
  assert.throws(() => parseArgs(["--model", "--other"], { strings: ["model", "other"] }), /requires a value/);
});

test("parseArgs: -- passthrough", () => {
  const { positional } = parseArgs(["--", "--looks-like-flag"], {});
  assert.deepEqual(positional, ["--looks-like-flag"]);
});

test("parseArgs: allowUnknown keeps unknown flags", () => {
  const { flags } = parseArgs(["--weird=1"], { allowUnknown: true });
  assert.equal(flags.weird, "1");
});
