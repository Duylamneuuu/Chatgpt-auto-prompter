import assert from "node:assert/strict";
import test from "node:test";
import { ErrorCode, PrompterError } from "../src/core/errors.js";
import { Prompter } from "../src/core/prompter.js";
import {
  ChatGptSupervisor,
  operationIdFor,
  parseSupervisorDecisionText,
} from "../src/supervisors/chatgpt/chatgpt-supervisor.js";
import { MemoryOperationStore } from "../src/supervisors/operation-store.js";

class NoopExecutor {
  async execute() {
    return { status: "completed", report: "done", exitCode: 0 };
  }
}

test("operation IDs are stable across retries of the same phase and cycle", () => {
  assert.equal(operationIdFor({ phase: "plan", cycle: 0 }), "plan:0");
  assert.equal(operationIdFor({ phase: "review", cycle: 3 }), "review:3");
});

test("strict JSON and a single fenced JSON object are accepted", () => {
  assert.equal(parseSupervisorDecisionText('{"kind":"done","summary":"ok"}').kind, "done");
  assert.equal(
    parseSupervisorDecisionText('```json\n{"kind":"blocked","reason":"login"}\n```').kind,
    "blocked",
  );
  assert.throws(
    () => parseSupervisorDecisionText('Looks good. {"kind":"done","summary":"ok"}'),
    (error) => error.code === ErrorCode.INVALID_SUPERVISOR_DECISION,
  );
});

test("a committed prompt is not submitted twice after UI healing", async () => {
  const operationStore = new MemoryOperationStore();
  let submitCalls = 0;
  let waitCalls = 0;

  const driver = {
    async prepare() {
      return { conversationId: "chat-1", conversationUrl: "https://chatgpt.com/c/chat-1" };
    },
    async submit() {
      submitCalls += 1;
      return { committed: true, submissionId: "user-turn-1", conversationId: "chat-1" };
    },
    async waitForResponse() {
      waitCalls += 1;
      if (waitCalls === 1) {
        throw new PrompterError(ErrorCode.UI_RECIPE_MISS, "assistant turn selector moved");
      }
      return {
        complete: true,
        responseId: "assistant-turn-1",
        text: '{"kind":"done","summary":"accepted"}',
      };
    },
  };

  const healer = { async heal() { return true; } };
  const supervisor = new ChatGptSupervisor({ driver, operationStore });
  const result = await new Prompter(supervisor, new NoopExecutor(), { uiHealer: healer }).run("brief");

  assert.equal(result.kind, "done");
  assert.equal(submitCalls, 1);
  assert.equal(waitCalls, 2);
  assert.equal((await operationStore.get("plan:0")).state, "captured");
});

test("unverified prompt commit fails closed", async () => {
  const supervisor = new ChatGptSupervisor({
    driver: {
      async prepare() { return {}; },
      async submit() { return { committed: false }; },
      async waitForResponse() { throw new Error("must not run"); },
    },
  });

  await assert.rejects(
    () => supervisor.decide({ phase: "plan", cycle: 0, brief: "brief" }),
    (error) => error.code === ErrorCode.PROMPT_COMMIT_UNVERIFIED,
  );
});

test("unverified response completion fails closed", async () => {
  const supervisor = new ChatGptSupervisor({
    driver: {
      async prepare() { return {}; },
      async submit() { return { committed: true, submissionId: "u1" }; },
      async waitForResponse() { return { complete: false, text: "partial" }; },
    },
  });

  await assert.rejects(
    () => supervisor.decide({ phase: "plan", cycle: 0, brief: "brief" }),
    (error) => error.code === ErrorCode.RESPONSE_COMPLETION_UNVERIFIED,
  );
});
