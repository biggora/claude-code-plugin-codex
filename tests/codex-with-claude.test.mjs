import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const WRAPPER = fileURLToPath(new URL("../scripts/codex-with-claude.mjs", import.meta.url));

test("codex-with-claude: rejects invalid --max-iterations before spawning codex", () => {
  const r = spawnSync("node", [WRAPPER, "hello", "--max-iterations", "nope"], {
    env: { ...process.env, NO_COLOR: "1" },
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--max-iterations/);
});
