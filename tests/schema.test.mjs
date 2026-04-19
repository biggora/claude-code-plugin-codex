import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(new URL("../schemas/review-output.schema.json", import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

async function makeValidator() {
  const mod = await import("ajv/dist/2020.js");
  const Ajv = mod.default ?? mod.Ajv ?? mod;
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

test("schema: valid minimal allow", async () => {
  const v = await makeValidator();
  const ok = v({ verdict: "allow", summary: "looks good", findings: [] });
  assert.equal(ok, true, JSON.stringify(v.errors));
});

test("schema: valid block with findings", async () => {
  const v = await makeValidator();
  const ok = v({
    verdict: "block",
    summary: "Silent error swallowing detected.",
    findings: [
      {
        severity: "high",
        title: "Silent catch",
        detail: "The try/catch rethrows nothing.",
        file: "src/api.js",
        line_start: 42,
        line_end: 50,
        confidence: 0.92,
        suggestion: "Log and rethrow or narrow the catch.",
      },
    ],
    next_action: "Rewrite the error handler.",
  });
  assert.equal(ok, true, JSON.stringify(v.errors));
});

test("schema: rejects unknown verdict", async () => {
  const v = await makeValidator();
  const ok = v({ verdict: "maybe", summary: "x", findings: [] });
  assert.equal(ok, false);
  assert.ok(v.errors.some((e) => /verdict/.test(e.instancePath) || /enum/.test(e.message)));
});

test("schema: rejects missing summary", async () => {
  const v = await makeValidator();
  const ok = v({ verdict: "allow", findings: [] });
  assert.equal(ok, false);
});

test("schema: rejects extra top-level props", async () => {
  const v = await makeValidator();
  const ok = v({ verdict: "allow", summary: "x", findings: [], extra: 1 });
  assert.equal(ok, false);
});

test("schema: rejects confidence outside 0..1", async () => {
  const v = await makeValidator();
  const ok = v({
    verdict: "block",
    summary: "x",
    findings: [{ severity: "low", title: "t", confidence: 1.5 }],
  });
  assert.equal(ok, false);
});
