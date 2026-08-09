import assert from "node:assert/strict";
import test from "node:test";
import { ErrorCode } from "../src/core/errors.js";
import { CodexExecExecutor } from "../src/executors/codex-exec.js";

test("Codex executor extracts the final message from a real JSONL child process", async () => {
  const script = `
    const events = [
      { type: "thread.started", thread_id: "t-1" },
      { type: "turn.started" },
      { type: "item.completed", item: { id: "cmd", type: "command_execution", command: "false", aggregated_output: "failed first attempt", exit_code: 1, status: "failed" } },
      { type: "item.completed", item: { id: "err", type: "error", message: "non-fatal item error" } },
      { type: "item.completed", item: { id: "msg", type: "agent_message", text: "final report" } },
      { type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0 } }
    ];
    for (const event of events) console.log(JSON.stringify(event));
  `;

  const executor = new CodexExecExecutor({
    command: process.execPath,
    args: ["-e", script, "--", "--json"],
    projectDir: process.cwd(),
    timeoutMs: 2_000,
  });

  const result = await executor.execute({ id: "task", prompt: "test" });
  assert.equal(result.status, "completed");
  assert.equal(result.report, "final report");
  assert.equal(result.metadata.threadId, "t-1");
  assert.equal(result.metadata.commandFailures.length, 1);
  assert.deepEqual(result.metadata.itemErrors, ["non-fatal item error"]);
});

test("JSON mode fails closed when the event stream never proves turn completion", async () => {
  const script = `
    console.log(JSON.stringify({ type: "thread.started", thread_id: "t-2" }));
    console.log(JSON.stringify({ type: "item.completed", item: { id: "msg", type: "agent_message", text: "looks finished but is unconfirmed" } }));
  `;

  const executor = new CodexExecExecutor({
    command: process.execPath,
    args: ["-e", script, "--", "--json"],
    projectDir: process.cwd(),
    timeoutMs: 2_000,
  });

  const result = await executor.execute({ id: "task", prompt: "test" });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, ErrorCode.EXECUTOR_PROCESS_FAILED);
  assert.match(result.report, /without turn\.completed/);
});

test("executor timeout returns a structured failed result", async () => {
  const script = `setInterval(() => {}, 1000);`;
  const executor = new CodexExecExecutor({
    command: process.execPath,
    args: ["-e", script, "--", "--json"],
    projectDir: process.cwd(),
    timeoutMs: 80,
  });

  const result = await executor.execute({ id: "task", prompt: "test" });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, ErrorCode.EXECUTOR_TIMEOUT);
});
