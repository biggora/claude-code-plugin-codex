import { test } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("..", import.meta.url);
const commandsDir = new URL("../commands/", import.meta.url);

function readText(path) {
  return readFileSync(path, "utf8");
}

function parseFrontmatter(source, file) {
  assert.ok(source.startsWith("---\n"), `${file} must start with YAML frontmatter`);
  const end = source.indexOf("\n---", 4);
  assert.notEqual(end, -1, `${file} must close YAML frontmatter`);

  const metadata = {};
  const lines = source.slice(4, end).trim().split(/\r?\n/);
  for (const line of lines) {
    const match = /^([A-Za-z0-9-]+):\s*(.*)$/.exec(line);
    assert.ok(match, `${file} has unsupported frontmatter line: ${line}`);
    metadata[match[1]] = match[2];
  }
  return metadata;
}

test("plugin commands: Codex-compatible frontmatter and shim dispatch", () => {
  const files = readdirSync(commandsDir).filter((file) => file.endsWith(".md")).sort();
  assert.deepEqual(files, [
    "adversarial-review.md",
    "cancel.md",
    "rescue.md",
    "result.md",
    "review.md",
    "setup.md",
    "status.md",
    "toggle.md",
  ]);

  for (const file of files) {
    const source = readText(new URL(file, commandsDir));
    const metadata = parseFrontmatter(source, file);

    assert.ok(metadata.description, `${file} must describe the command`);
    assert.ok(metadata["argument-hint"], `${file} must provide an argument hint`);
    assert.equal(metadata["allowed-tools"], undefined, `${file} must not use Claude Code allowed-tools`);
    assert.match(source, /scripts\/slash-command\.mjs/, `${file} must route through the slash-command shim`);
    assert.match(source, /\$ARGUMENTS/, `${file} must preserve slash command arguments`);
    assert.doesNotMatch(source, /CLAUDE_PLUGIN_ROOT/, `${file} must not use Claude-specific plugin env vars`);
    assert.doesNotMatch(source, /<<['"]?CLAUDE_REVIEW_ARGS/, `${file} must not use shell heredocs`);
    assert.doesNotMatch(source, /--args-stdin/, `${file} must not rely on stdin heredoc argument passing`);
  }
});

test("plugin marketplace: current local marketplace schema", () => {
  const marketplace = JSON.parse(readText(new URL("../.agents/plugins/marketplace.json", import.meta.url)));
  assert.equal(marketplace.name, "claude-review-local");
  assert.equal(marketplace.interface.displayName, "Claude Review");
  assert.equal(marketplace.plugins.length, 1);

  const [plugin] = marketplace.plugins;
  assert.equal(plugin.name, "claude-review");
  assert.deepEqual(plugin.source, { source: "local", path: "./" });
  assert.deepEqual(plugin.policy, { installation: "AVAILABLE", authentication: "ON_INSTALL" });
  assert.equal(plugin.category, "Productivity");
  assert.equal(plugin.manifest, undefined);
});

test("plugin manifest: optional component paths are strings when present", () => {
  const manifest = JSON.parse(readText(new URL("../.codex-plugin/plugin.json", import.meta.url)));
  assert.equal(manifest.name, "claude-review");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.hooks, "./hooks.json");
  assert.equal(manifest.interface.category, "Productivity");
  assert.deepEqual(manifest.interface.capabilities, ["Interactive", "Read", "Write"]);

  for (const field of ["skills", "hooks", "mcpServers", "apps"]) {
    if (manifest[field] != null) {
      assert.equal(typeof manifest[field], "string", `${field} must be a string path when present`);
      assert.match(manifest[field], /^\.\//, `${field} path must be relative to the plugin root`);
    }
  }
});

test("npm package: local marketplace entry is not ignored", () => {
  const npmignore = readText(new URL("../.npmignore", import.meta.url));
  assert.match(npmignore, /^\.agents\/\*/m);
  assert.match(npmignore, /^!\.agents\/plugins\//m);
  assert.match(npmignore, /^!\.agents\/plugins\/marketplace\.json$/m);
});

test("slash-command shim: help is available", () => {
  const output = execFileSync(process.execPath, [join(fileURLToPath(repoRoot), "scripts", "slash-command.mjs"), "--help"], {
    encoding: "utf8",
  });
  assert.match(output, /claude-review slash command shim/);
  assert.match(output, /setup, toggle, status, result, cancel, review, adversarial-review, rescue/);
});
