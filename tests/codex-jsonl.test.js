import assert from "node:assert/strict";
import test from "node:test";
import { CodexJsonlCollector, parseCodexExecJsonl } from "../src/executors/codex-jsonl.js";

test("summarizes Codex exec JSONL and keeps the final agent message", () => {
  const jsonl = [
    { type: "thread.started", thread_id: "thread-123" },
    { type: "turn.started" },
    {
      type: "item.completed",
      item: {
        id: "cmd-1",
        type: "command_execution",
        command: "npm test",
        aggregated_output: "one test failed",
        exit_code: 1,
        status: "failed",
      },
    },
    {
      type: "item.completed",
      item: {
        id: "patch-1",
        type: "file_change",
        changes: [
          { path: "src/a.js", kind: "update" },
          { path: "src/b.js", kind: "add" },
        ],
        status: "completed",
      },
    },
    {
      type: "item.completed",
      item: { id: "message-1", type: "agent_message", text: "intermediate" },
    },
    {
      type: "item.completed",
      item: { id: "message-2", type: "agent_message", text: "final handoff" },
    },
    {
      type: "turn.completed",
      usage: {
        input_tokens: 100,
        cached_input_tokens: 50,
        cache_write_input_tokens: 0,
        output_tokens: 20,
        reasoning_output_tokens: 10,
      },
    },
  ].map((event) => JSON.stringify(event)).join("\n");

  const result = parseCodexExecJsonl(jsonl);
  assert.equal(result.threadId, "thread-123");
  assert.equal(result.turnStarted, true);
  assert.equal(result.turnCompleted, true);
  assert.equal(result.finalAgentText, "final handoff");
  assert.deepEqual(result.changedFiles, [
    { path: "src/a.js", kind: "update" },
    { path: "src/b.js", kind: "add" },
  ]);
  assert.equal(result.commandFailures.length, 1);
  assert.equal(result.usage.output_tokens, 20);
});

test("collector accepts arbitrarily split chunks", () => {
  const collector = new CodexJsonlCollector();
  const line = `${JSON.stringify({
    type: "item.completed",
    item: { id: "m", type: "agent_message", text: "hello" },
  })}\n${JSON.stringify({ type: "turn.completed", usage: {} })}\n`;

  collector.push(line.slice(0, 11));
  collector.push(line.slice(11, 37));
  collector.push(line.slice(37));
  const result = collector.finish();

  assert.equal(result.finalAgentText, "hello");
  assert.equal(result.turnCompleted, true);
  assert.equal(result.invalidLineCount, 0);
});

test("invalid lines do not destroy the rest of the stream", () => {
  const result = parseCodexExecJsonl([
    "not-json",
    JSON.stringify({ type: "thread.started", thread_id: "abc" }),
    JSON.stringify({ type: "error", message: "stream problem" }),
  ].join("\n"));

  assert.equal(result.invalidLineCount, 1);
  assert.equal(result.threadId, "abc");
  assert.deepEqual(result.streamErrors, ["stream problem"]);
});

test("raw transcript storage is bounded", () => {
  const collector = new CodexJsonlCollector({ maxRawTailChars: 20 });
  collector.push("012345678901234567890123456789");
  const result = collector.finish();
  assert.equal(result.rawTail.length, 20);
  assert.equal(result.rawTail, "01234567890123456789");
});
