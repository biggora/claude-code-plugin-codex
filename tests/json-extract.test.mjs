import { test } from "node:test";
import { strict as assert } from "node:assert";
import { extractJsonObject, formatAjvErrors } from "../scripts/lib/json-extract.mjs";

test("extractJsonObject: pure JSON roundtrips", () => {
  const obj = extractJsonObject('{"verdict":"allow","summary":"x"}');
  assert.deepEqual(obj, { verdict: "allow", summary: "x" });
});

test("extractJsonObject: JSON wrapped in prose", () => {
  const raw = "Here is the review:\n\n```json\n{\"verdict\":\"block\",\"findings\":[]}\n```\n\nDone.";
  const obj = extractJsonObject(raw);
  assert.equal(obj.verdict, "block");
});

test("extractJsonObject: nested braces respected", () => {
  const raw = 'prefix {"a":{"b":{"c":1}},"d":2} suffix';
  const obj = extractJsonObject(raw);
  assert.equal(obj.a.b.c, 1);
  assert.equal(obj.d, 2);
});

test("extractJsonObject: braces inside strings do not confuse extractor", () => {
  const raw = 'noise {"key":"value with }{ inside","k2":42} more';
  const obj = extractJsonObject(raw);
  assert.equal(obj.k2, 42);
  assert.match(obj.key, /inside/);
});

test("extractJsonObject: null/empty inputs", () => {
  assert.equal(extractJsonObject(null), null);
  assert.equal(extractJsonObject(""), null);
  assert.equal(extractJsonObject("no json here"), null);
});

test("extractJsonObject: malformed JSON returns null", () => {
  assert.equal(extractJsonObject("{not really json"), null);
});

test("formatAjvErrors: formats multiple errors compactly", () => {
  const msg = formatAjvErrors([
    { instancePath: "/verdict", message: "must be equal to one of" },
    { instancePath: "/findings/0/severity", message: "must be one of enum" },
  ]);
  assert.match(msg, /\/verdict/);
  assert.match(msg, /\/findings\/0\/severity/);
});

test("formatAjvErrors: handles null / empty", () => {
  assert.equal(formatAjvErrors(null), "unknown validation error");
  assert.equal(formatAjvErrors([]), "unknown validation error");
});

test("formatAjvErrors: truncates beyond 5 errors", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ instancePath: `/f${i}`, message: "bad" }));
  const out = formatAjvErrors(many);
  const count = (out.match(/bad/g) || []).length;
  assert.equal(count, 5);
});
