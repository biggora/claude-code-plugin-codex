import { test } from "node:test";
import { strict as assert } from "node:assert";
import { getDataRoot } from "../scripts/lib/paths.mjs";

const DATA_ENV_KEYS = ["PLUGIN_DATA", "CODEX_PLUGIN_DATA", "CLAUDE_PLUGIN_DATA"];

function withDataEnv(values, fn) {
  const previous = new Map(DATA_ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of DATA_ENV_KEYS) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        process.env[key] = values[key];
      } else {
        delete process.env[key];
      }
    }
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("paths: PLUGIN_DATA takes precedence over compatibility env vars", () => {
  withDataEnv(
    {
      PLUGIN_DATA: "/plugin-data",
      CODEX_PLUGIN_DATA: "/codex-plugin-data",
      CLAUDE_PLUGIN_DATA: "/claude-plugin-data",
    },
    () => {
      assert.equal(getDataRoot(), "/plugin-data");
    },
  );
});

test("paths: CODEX_PLUGIN_DATA remains the first compatibility fallback", () => {
  withDataEnv(
    {
      CODEX_PLUGIN_DATA: "/codex-plugin-data",
      CLAUDE_PLUGIN_DATA: "/claude-plugin-data",
    },
    () => {
      assert.equal(getDataRoot(), "/codex-plugin-data");
    },
  );
});
