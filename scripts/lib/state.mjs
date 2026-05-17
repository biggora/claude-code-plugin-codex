import { closeSync, chmodSync, existsSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { stateFile } from "./paths.mjs";

const CURRENT_VERSION = 1;
const LOCK_TIMEOUT_MS = 2000;
const LOCK_RETRY_MS = 25;

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
  return withStateLock(workspaceKey, () => writeStateUnlocked(workspaceKey, state));
}

function writeStateUnlocked(workspaceKey, state) {
  const file = stateFile(workspaceKey);
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  const payload = JSON.stringify(state, null, 2);
  writeFileSync(tmp, payload, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, file);
  try {
    chmodSync(file, 0o600);
  } catch {
    // best-effort
  }
}

export function updateState(workspaceKey, mutator) {
  return withStateLock(workspaceKey, () => {
    const state = readState(workspaceKey);
    const next = mutator(state) ?? state;
    next.version = CURRENT_VERSION;
    writeStateUnlocked(workspaceKey, next);
    return next;
  });
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

function withStateLock(workspaceKey, fn) {
  const lock = `${stateFile(workspaceKey)}.lock`;
  const start = Date.now();
  let fd = null;
  while (fd == null) {
    try {
      fd = openSync(lock, "wx", 0o600);
    } catch (err) {
      if (Date.now() - start > LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out acquiring state lock: ${err?.message ?? "unknown error"}`);
      }
      sleepSync(LOCK_RETRY_MS);
    }
  }
  try {
    return fn();
  } finally {
    try {
      closeSync(fd);
    } catch {
      // ignore
    }
    try {
      unlinkSync(lock);
    } catch {
      // ignore
    }
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
