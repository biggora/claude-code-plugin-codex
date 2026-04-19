import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { stateFile } from "./paths.mjs";

const CURRENT_VERSION = 1;

export function defaultState() {
  return {
    version: CURRENT_VERSION,
    config: {
      reviewGate: false,
      model: "claude-opus-4-7",
      maxToolCalls: 0,
      transport: "auto",
      effort: "medium",
      adversarialSchemaPath: "schemas/review-output.schema.json",
    },
    jobs: [],
    lastReview: null,
  };
}

export function readState(workspaceKey) {
  const file = stateFile(workspaceKey);
  if (!existsSync(file)) return defaultState();
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return defaultState();
  }
}

export function writeState(workspaceKey, state) {
  const file = stateFile(workspaceKey);
  const tmp = `${file}.tmp`;
  const payload = JSON.stringify(state, null, 2);
  writeFileSync(tmp, payload, "utf8");
  renameSync(tmp, file);
}

export function updateState(workspaceKey, mutator) {
  const state = readState(workspaceKey);
  const next = mutator(state) ?? state;
  next.version = CURRENT_VERSION;
  writeState(workspaceKey, next);
  return next;
}

export function setConfig(workspaceKey, key, value) {
  return updateState(workspaceKey, (state) => {
    state.config = { ...state.config, [key]: value };
    return state;
  });
}

function migrate(obj) {
  if (!obj || typeof obj !== "object") return defaultState();
  const version = obj.version ?? 0;
  let state = { ...defaultState(), ...obj };
  state.config = { ...defaultState().config, ...(obj.config ?? {}) };
  state.jobs = Array.isArray(obj.jobs) ? obj.jobs : [];
  if (version < CURRENT_VERSION) {
    state.version = CURRENT_VERSION;
  }
  return state;
}
