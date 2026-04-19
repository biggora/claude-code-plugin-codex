import { test } from "node:test";
import { strict as assert } from "node:assert";

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");

test("render: one-liner contains verdict label and reason", async () => {
  process.env.NO_COLOR = "1";
  const { renderReviewOneLine } = await import("../scripts/lib/render.mjs?t=" + Date.now());
  const out = stripAnsi(
    renderReviewOneLine({ verdict: "allow", reason: "looks good", transport: "claude-cli", latencyMs: 1234 }),
  );
  assert.match(out, /ALLOW/);
  assert.match(out, /looks good/);
  assert.match(out, /claude-cli/);
  assert.match(out, /1234ms/);
});

test("render: block block prints fullText body", async () => {
  process.env.NO_COLOR = "1";
  const { renderReviewBlock } = await import("../scripts/lib/render.mjs?t=" + (Date.now() + 1));
  const out = stripAnsi(
    renderReviewBlock({
      verdict: "block",
      reason: "BLOCK: missing test\ndetail line",
      fullText: "BLOCK: missing test\ndetail line",
    }),
  );
  assert.match(out, /BLOCK/);
  assert.match(out, /missing test/);
  assert.match(out, /detail line/);
});

test("render: findings sorted by severity", async () => {
  process.env.NO_COLOR = "1";
  const { renderFindings } = await import("../scripts/lib/render.mjs?t=" + (Date.now() + 2));
  const out = stripAnsi(
    renderFindings([
      { severity: "low", title: "minor", confidence: 0.5 },
      { severity: "critical", title: "breach", confidence: 0.9 },
      { severity: "medium", title: "mid", confidence: 0.7 },
    ]),
  );
  const idxCritical = out.indexOf("breach");
  const idxMid = out.indexOf("mid");
  const idxMinor = out.indexOf("minor");
  assert.ok(idxCritical < idxMid && idxMid < idxMinor, `ordering: ${out}`);
});

test("render: empty jobs list returns 'no tracked jobs'", async () => {
  process.env.NO_COLOR = "1";
  const { renderJobList } = await import("../scripts/lib/render.mjs?t=" + (Date.now() + 3));
  assert.match(stripAnsi(renderJobList([])), /no tracked jobs/);
});
