#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(process.env.PLUGIN_ROOT || dirname(fileURLToPath(import.meta.url)) + "/..");
const companionPath = resolve(pluginRoot, "scripts", "claude-companion.mjs");

const [slashCommand, ...rawArgs] = process.argv.slice(2);

const commandMap = new Map([
  ["setup", ["setup"]],
  ["toggle", ["toggle"]],
  ["status", ["status"]],
  ["result", ["result"]],
  ["cancel", ["cancel"]],
  ["review", ["review"]],
  ["adversarial-review", ["adversarial-review"]],
  ["rescue", ["task", "--json"]],
]);

if (!slashCommand || slashCommand === "help" || slashCommand === "--help" || slashCommand === "-h") {
  process.stdout.write(`claude-review slash command shim

Usage:
  slash-command <command> [args...]

Commands:
  setup, toggle, status, result, cancel, review, adversarial-review, rescue
`);
  process.exit(0);
}

const companionArgs = commandMap.get(slashCommand);
if (!companionArgs) {
  process.stderr.write(`Unknown claude-review slash command: ${slashCommand}\n`);
  process.exit(2);
}

const child = spawn(process.execPath, [companionPath, ...companionArgs, ...rawArgs], {
  cwd: process.cwd(),
  env: { ...process.env, PLUGIN_ROOT: pluginRoot },
  stdio: "inherit",
  shell: false,
});

child.on("error", (err) => {
  process.stderr.write(`Failed to start claude-review command: ${err.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    try {
      process.kill(process.pid, signal);
    } catch {
      process.exit(1);
    }
    return;
  }
  process.exit(code ?? 1);
});
