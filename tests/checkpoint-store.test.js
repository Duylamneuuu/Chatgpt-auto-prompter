import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CheckpointStore } from "../src/core/checkpoint-store.js";

test("checkpoint store returns null when no checkpoint exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompter-checkpoint-"));
  try {
    const store = new CheckpointStore(join(dir, "run.json"));
    assert.equal(await store.load(), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("checkpoint save replaces the previous checkpoint without temp leftovers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompter-checkpoint-"));
  try {
    const file = join(dir, "state", "run.json");
    const store = new CheckpointStore(file);

    await store.save({ version: 1, cycle: 1, state: "executing" });
    await store.save({ version: 1, cycle: 2, state: "reviewing" });

    assert.deepEqual(await store.load(), { version: 1, cycle: 2, state: "reviewing" });
    assert.deepEqual(await readdir(join(dir, "state")), ["run.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
