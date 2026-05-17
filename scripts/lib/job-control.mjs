import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve, sep } from "node:path";
import { log } from "./log.mjs";
import { resultsDir } from "./paths.mjs";
import { redact } from "./redact.mjs";
import { updateState, readState } from "./state.mjs";

const JOB_ID_RE = /^job_[a-f0-9]{16}$/;

export function newJobId() {
  return "job_" + randomUUID().replace(/-/g, "").slice(0, 16);
}

export function isJobId(id) {
  return typeof id === "string" && JOB_ID_RE.test(id);
}

export function assertJobId(id) {
  if (!isJobId(id)) throw new Error(`Invalid job id: ${String(id)}`);
  return id;
}

export function registerJob(workspaceKey, partial) {
  const job = {
    id: partial.id ?? newJobId(),
    kind: partial.kind ?? "task",
    command: partial.command ?? null,
    pid: partial.pid ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    resultPath: partial.resultPath ?? null,
    meta: partial.meta ?? {},
  };
  updateState(workspaceKey, (state) => {
    state.jobs = [...(state.jobs ?? []), job];
    return state;
  });
  return job;
}

export function finishJob(workspaceKey, id, { exitCode, resultPath } = {}) {
  updateState(workspaceKey, (state) => {
    state.jobs = (state.jobs ?? []).map((j) =>
      j.id === id
        ? {
            ...j,
            finishedAt: new Date().toISOString(),
            exitCode: exitCode ?? j.exitCode,
            resultPath: resultPath ?? j.resultPath,
          }
        : j,
    );
    return state;
  });
}

export function listJobs(workspaceKey) {
  return readState(workspaceKey).jobs ?? [];
}

export function findJob(workspaceKey, id) {
  return listJobs(workspaceKey).find((j) => j.id === id) ?? null;
}

export async function terminateJob(workspaceKey, id) {
  const job = findJob(workspaceKey, id);
  if (!job) return { ok: false, reason: "not-found" };
  if (job.finishedAt) return { ok: true, reason: "already-finished" };
  if (!job.pid) return { ok: false, reason: "no-pid" };
  const killed = await killTree(job.pid);
  finishJob(workspaceKey, id, { exitCode: killed ? -15 : job.exitCode });
  return { ok: killed };
}

export function reapStaleJobs(workspaceKey, { sessionId } = {}) {
  updateState(workspaceKey, (state) => {
    const jobs = state.jobs ?? [];
    state.jobs = jobs.map((j) => {
      if (j.finishedAt) return j;
      if (!j.pid || !pidAlive(j.pid)) {
        return { ...j, finishedAt: new Date().toISOString(), exitCode: j.exitCode ?? -1, meta: { ...j.meta, reaped: true, sessionId } };
      }
      return j;
    });
    return state;
  });
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killTree(pid) {
  try {
    const mod = await import("tree-kill");
    const treeKill = mod.default ?? mod;
    return await new Promise((resolve) => {
      treeKill(pid, "SIGKILL", (err) => {
        if (err) log.debug("tree-kill failed", { err: redact(err?.message ?? "") });
        resolve(!err);
      });
    });
  } catch {
    try {
      process.kill(pid, "SIGKILL");
      return true;
    } catch {
      return false;
    }
  }
}

export function resultPathFor(workspaceKey, jobId) {
  assertJobId(jobId);
  const root = resolve(resultsDir(workspaceKey));
  const candidate = resolve(root, `${jobId}.json`);
  const boundary = root.endsWith(sep) ? root : `${root}${sep}`;
  if (!candidate.startsWith(boundary)) {
    throw new Error(`Invalid result path for job id: ${jobId}`);
  }
  return candidate;
}

export function resultExists(workspaceKey, jobId) {
  return existsSync(resultPathFor(workspaceKey, jobId));
}
