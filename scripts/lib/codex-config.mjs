import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { codexConfigPath } from "./paths.mjs";

export async function ensureHooksEnabled() {
  const path = codexConfigPath();
  const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
  const state = parseFeatures(raw);

  if (state.hooks === true && state.pluginHooks === true && state.codexHooks === undefined) {
    return { changed: false, path };
  }

  if (raw && existsSync(path)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(path, `${path}.bak-${ts}`);
  }

  const updated = upsertFeatureFlags(raw, {
    hooks: true,
    plugin_hooks: true,
    codex_hooks: null,
  });

  writeFileSync(path, updated, "utf8");
  return { changed: true, path };
}

export function codexConfigState() {
  const path = codexConfigPath();
  if (!existsSync(path)) {
    return { exists: false, hasHooks: false, hasPluginHooks: false, path };
  }
  const raw = readFileSync(path, "utf8");
  const state = parseFeatures(raw);
  return {
    exists: true,
    hasHooks: state.hooks === true || state.codexHooks === true,
    hasPluginHooks: state.pluginHooks === true,
    path,
  };
}

function parseFeatures(raw) {
  const entries = new Map();
  const lines = raw.split(/\r?\n/);
  let inFeatures = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const section = trimmed.match(/^\[([^\]]+)\]\s*$/);
    if (section) {
      inFeatures = section[1] === "features";
      continue;
    }
    if (!inFeatures) continue;
    const m = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(true|false)\s*(?:#.*)?$/);
    if (m) entries.set(m[1], m[2] === "true");
  }
  return {
    hooks: entries.get("hooks"),
    pluginHooks: entries.get("plugin_hooks"),
    codexHooks: entries.get("codex_hooks"),
  };
}

function upsertFeatureFlags(raw, updates) {
  const lines = raw.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  const sectionStart = lines.findIndex((line) => line.trim() === "[features]");
  if (sectionStart === -1) {
    const prefix = lines.length > 0 ? [""] : [];
    return [...lines, ...prefix, "[features]", ...formatUpdates(updates)].join("\n") + "\n";
  }

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  const section = lines.slice(sectionStart + 1, sectionEnd).filter((line) => {
    const m = line.trim().match(/^([A-Za-z0-9_-]+)\s*=/);
    return !m || !(m[1] in updates);
  });

  const replacements = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) continue;
    replacements.push(`${key} = ${value ? "true" : "false"}`);
  }

  const before = lines.slice(0, sectionStart + 1);
  const after = lines.slice(sectionEnd);
  const updated = [...before, ...replacements, ...section, ...after].join("\n");
  return updated + "\n";
}

function formatUpdates(updates) {
  return Object.entries(updates)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key} = ${value ? "true" : "false"}`);
}
