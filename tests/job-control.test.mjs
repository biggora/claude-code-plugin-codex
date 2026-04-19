import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("job-control: register / finish / list", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-jobs-"));
  process.env.CODEX_PLUGIN_DATA = tmp;
  try {
    const { registerJob, finishJob, listJobs, findJob, newJobId } = await import(
      "../scripts/lib/job-control.mjs?t=" + Date.now()
    );
    const key = "wkspckeytestjob";
    const id = newJobId();
    assert.match(id, /^job_/);

    const job = registerJob(key, { id, kind: "task", pid: 0, command: "test" });
    assert.equal(job.id, id);
    assert.equal(job.kind, "task");
    assert.equal(job.finishedAt, null);

    const list1 = listJobs(key);
    assert.equal(list1.length, 1);
    assert.equal(list1[0].id, id);

    finishJob(key, id, { exitCode: 0, resultPath: "/tmp/foo" });
    const after = findJob(key, id);
    assert.ok(after.finishedAt);
    assert.equal(after.exitCode, 0);
    assert.equal(after.resultPath, "/tmp/foo");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.CODEX_PLUGIN_DATA;
  }
});

test("job-control: terminateJob on already-finished job returns already-finished", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-jobs-term-"));
  process.env.CODEX_PLUGIN_DATA = tmp;
  try {
    const { registerJob, finishJob, terminateJob } = await import(
      "../scripts/lib/job-control.mjs?t=" + (Date.now() + 1)
    );
    const key = "wkspckeyterm";
    const job = registerJob(key, { kind: "task", pid: 99999 });
    finishJob(key, job.id, { exitCode: 0 });
    const res = await terminateJob(key, job.id);
    assert.equal(res.ok, true);
    assert.equal(res.reason, "already-finished");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.CODEX_PLUGIN_DATA;
  }
});

test("job-control: terminateJob unknown id", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "cr-jobs-unk-"));
  process.env.CODEX_PLUGIN_DATA = tmp;
  try {
    const { terminateJob } = await import(
      "../scripts/lib/job-control.mjs?t=" + (Date.now() + 2)
    );
    const res = await terminateJob("wkspckeymissing", "job_doesnotexist");
    assert.equal(res.ok, false);
    assert.equal(res.reason, "not-found");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.CODEX_PLUGIN_DATA;
  }
});
