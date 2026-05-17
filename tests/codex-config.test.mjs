import { test } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";

test("codex-config: migrates deprecated codex_hooks to hooks and plugin_hooks", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-codex-config-"));
  const oldHome = process.env.HOME;
  const oldUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmp;
  process.env.USERPROFILE = tmp;
  try {
    const configDir = join(tmp, ".codex");
    const configPath = join(configDir, "config.toml");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      configPath,
      [
        "model = \"gpt-5.4\"",
        "",
        "[features]",
        "codex_hooks = true",
        "fast_mode = true",
        "",
        "[profiles.default]",
        "model = \"gpt-5.4\"",
        "",
      ].join("\n"),
      "utf8",
    );

    const { ensureHooksEnabled, codexConfigState } = await import(
      "../scripts/lib/codex-config.mjs?t=" + Date.now()
    );
    const result = await ensureHooksEnabled();
    const raw = readFileSync(configPath, "utf8");
    assert.equal(result.changed, true);
    assert.equal(codexConfigState().hasHooks, true);
    assert.equal(codexConfigState().hasPluginHooks, true);
    assert.match(raw, /\[features\]\nhooks = true\nplugin_hooks = true\nfast_mode = true/);
    assert.doesNotMatch(raw, /codex_hooks/);
    assert.equal(existsSync(result.path), true);
    assert.ok(readdirSync(configDir).some((name) => name.startsWith("config.toml.bak-")));
  } finally {
    if (oldHome == null) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldUserProfile == null) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = oldUserProfile;
    rmSync(tmp, { recursive: true, force: true });
  }
});
