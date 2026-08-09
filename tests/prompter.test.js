import assert from "node:assert/strict";
import test from "node:test";
import { Prompter } from "../src/core/prompter.js";
import { validateDecision } from "../src/supervisors/command-supervisor.js";

class FakeExecutor {
  calls = [];
  async execute(task) {
    this.calls.push(task);
    return { status: "completed", report: `completed:${task.id}`, exitCode: 0 };
  }
}

class TwoStepSupervisor {
  reviewCount = 0;
  async decide(input) {
    if (input.phase === "plan") {
      return { kind: "next_task", task: { id: "one", prompt: "first" } };
    }
    this.reviewCount += 1;
    if (this.reviewCount === 1) {
      return { kind: "next_task", task: { id: "two", prompt: "second" } };
    }
    return { kind: "done", summary: "accepted" };
  }
}

test("loops until supervisor returns done", async () => {
  const executor = new FakeExecutor();
  const supervisor = new TwoStepSupervisor();
  const result = await new Prompter(supervisor, executor, { maxCycles: 5 }).run("brief");

  assert.equal(result.kind, "done");
  assert.deepEqual(executor.calls.map((task) => task.id), ["one", "two"]);
});

test("blocks at maxCycles", async () => {
  const executor = new FakeExecutor();
  const supervisor = {
    async decide(input) {
      return { kind: "next_task", task: { id: `task-${input.cycle}`, prompt: "again" } };
    },
  };

  const result = await new Prompter(supervisor, executor, { maxCycles: 2 }).run("brief");
  assert.equal(result.kind, "blocked");
  assert.equal(executor.calls.length, 2);
});

test("validates supervisor protocol", () => {
  assert.equal(validateDecision({ kind: "done", summary: "ok" }).kind, "done");
  assert.throws(() => validateDecision({ kind: "next_task", task: { id: 1 } }));
});

test("UI healer is only invoked for UI recipe drift", async () => {
  let healed = 0;
  const healer = { async heal() { healed += 1; return true; } };
  const executor = new FakeExecutor();
  const supervisor = { async decide() { throw new Error("backend exploded"); } };

  await assert.rejects(() => new Prompter(supervisor, executor, { uiHealer: healer }).run("brief"));
  assert.equal(healed, 0);
});
