import assert from "node:assert/strict";
import test from "node:test";
import { ErrorCode, PrompterError } from "../src/core/errors.js";
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
  assert.equal(result.code, "MAX_CYCLES_REACHED");
  assert.equal(executor.calls.length, 2);
});

test("validates supervisor protocol", () => {
  assert.equal(validateDecision({ kind: "done", summary: "ok" }).kind, "done");
  assert.throws(
    () => validateDecision({ kind: "next_task", task: { id: 1 } }),
    (error) => error.code === ErrorCode.INVALID_SUPERVISOR_DECISION,
  );
});

test("direct supervisors are validated by the core", async () => {
  const supervisor = { async decide() { return { kind: "wat" }; } };
  const executor = new FakeExecutor();

  await assert.rejects(
    () => new Prompter(supervisor, executor).run("brief"),
    (error) => error.code === ErrorCode.INVALID_SUPERVISOR_DECISION,
  );
});

test("executor results are validated by the core", async () => {
  const supervisor = {
    async decide(input) {
      if (input.phase === "plan") {
        return { kind: "next_task", task: { id: "one", prompt: "first" } };
      }
      return { kind: "done", summary: "accepted" };
    },
  };
  const executor = { async execute() { return { status: "mystery" }; } };

  await assert.rejects(
    () => new Prompter(supervisor, executor).run("brief"),
    (error) => error.code === ErrorCode.INVALID_EXECUTOR_RESULT,
  );
});

test("UI healer is only invoked for UI recipe drift", async () => {
  let healed = 0;
  const healer = { async heal() { healed += 1; return true; } };
  const executor = new FakeExecutor();
  const supervisor = { async decide() { throw new Error("backend exploded"); } };

  await assert.rejects(() => new Prompter(supervisor, executor, { uiHealer: healer }).run("brief"));
  assert.equal(healed, 0);
});

test("UI recipe drift may heal once and then retry", async () => {
  let supervisorCalls = 0;
  let healerCalls = 0;
  const supervisor = {
    async decide() {
      supervisorCalls += 1;
      if (supervisorCalls === 1) {
        throw new PrompterError(ErrorCode.UI_RECIPE_MISS, "composer moved");
      }
      return { kind: "done", summary: "recovered" };
    },
  };
  const healer = { async heal() { healerCalls += 1; return true; } };

  const result = await new Prompter(supervisor, new FakeExecutor(), { uiHealer: healer }).run("brief");
  assert.equal(result.kind, "done");
  assert.equal(supervisorCalls, 2);
  assert.equal(healerCalls, 1);
});

test("UI healing never recursively retries a still-broken recipe", async () => {
  let supervisorCalls = 0;
  let healerCalls = 0;
  const supervisor = {
    async decide() {
      supervisorCalls += 1;
      throw new PrompterError(ErrorCode.UI_RECIPE_MISS, "still missing");
    },
  };
  const healer = { async heal() { healerCalls += 1; return true; } };

  await assert.rejects(
    () => new Prompter(supervisor, new FakeExecutor(), { uiHealer: healer }).run("brief"),
    (error) => error.code === ErrorCode.UI_RECIPE_MISS,
  );
  assert.equal(supervisorCalls, 2);
  assert.equal(healerCalls, 1);
});

test("a failed UI heal becomes a structured failure", async () => {
  const supervisor = {
    async decide() {
      throw new PrompterError(ErrorCode.UI_RECIPE_MISS, "send button moved");
    },
  };
  const healer = { async heal() { return false; } };

  await assert.rejects(
    () => new Prompter(supervisor, new FakeExecutor(), { uiHealer: healer }).run("brief"),
    (error) => error.code === ErrorCode.UI_HEAL_FAILED,
  );
});
