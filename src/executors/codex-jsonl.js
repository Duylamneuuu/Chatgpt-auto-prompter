const DEFAULT_RAW_TAIL_CHARS = 24_000;

/**
 * Incrementally summarizes `codex exec --json` JSONL without retaining the full
 * transcript in memory. Event names and item shapes follow Codex's published
 * exec/TypeScript SDK event contract.
 */
export class CodexJsonlCollector {
  constructor(options = {}) {
    this.maxRawTailChars = options.maxRawTailChars ?? DEFAULT_RAW_TAIL_CHARS;
    this.lineBuffer = "";
    this.rawTail = "";
    this.eventCount = 0;
    this.invalidLineCount = 0;
    this.threadId = null;
    this.turnStarted = false;
    this.turnCompleted = false;
    this.turnFailed = null;
    this.usage = null;
    this.finalAgentText = "";
    this.changedFiles = new Map();
    this.commandFailures = [];
    this.toolFailures = [];
    this.streamErrors = [];
  }

  push(chunk) {
    const text = String(chunk ?? "");
    this.#appendRawTail(text);
    this.lineBuffer += text;

    while (true) {
      const newlineIndex = this.lineBuffer.indexOf("\n");
      if (newlineIndex < 0) break;
      const line = this.lineBuffer.slice(0, newlineIndex);
      this.lineBuffer = this.lineBuffer.slice(newlineIndex + 1);
      this.#consumeLine(line);
    }
  }

  finish() {
    if (this.lineBuffer.trim()) this.#consumeLine(this.lineBuffer);
    this.lineBuffer = "";
    return this.summary();
  }

  summary() {
    return {
      eventCount: this.eventCount,
      invalidLineCount: this.invalidLineCount,
      threadId: this.threadId,
      turnStarted: this.turnStarted,
      turnCompleted: this.turnCompleted,
      turnFailed: this.turnFailed,
      usage: this.usage,
      finalAgentText: this.finalAgentText,
      changedFiles: [...this.changedFiles.entries()].map(([path, kind]) => ({ path, kind })),
      commandFailures: [...this.commandFailures],
      toolFailures: [...this.toolFailures],
      streamErrors: [...this.streamErrors],
      rawTail: this.rawTail,
    };
  }

  #consumeLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      this.invalidLineCount += 1;
      return;
    }

    if (!event || typeof event !== "object") return;
    this.eventCount += 1;

    switch (event.type) {
      case "thread.started":
        if (typeof event.thread_id === "string") this.threadId = event.thread_id;
        break;
      case "turn.started":
        this.turnStarted = true;
        break;
      case "turn.completed":
        this.turnCompleted = true;
        this.usage = normalizeUsage(event.usage);
        break;
      case "turn.failed":
        this.turnFailed = normalizeMessage(event.error?.message ?? event.error ?? "Codex turn failed");
        break;
      case "error":
        this.streamErrors.push(normalizeMessage(event.message ?? "Codex stream error"));
        break;
      case "item.completed":
        this.#consumeCompletedItem(event.item);
        break;
      default:
        break;
    }
  }

  #consumeCompletedItem(item) {
    if (!item || typeof item !== "object") return;

    switch (item.type) {
      case "agent_message":
        if (typeof item.text === "string" && item.text.trim()) {
          this.finalAgentText = item.text;
        }
        break;
      case "file_change":
        for (const change of Array.isArray(item.changes) ? item.changes : []) {
          if (typeof change?.path === "string") {
            this.changedFiles.set(change.path, typeof change.kind === "string" ? change.kind : "update");
          }
        }
        break;
      case "command_execution":
        if (item.status === "failed" || (Number.isInteger(item.exit_code) && item.exit_code !== 0)) {
          this.commandFailures.push({
            command: typeof item.command === "string" ? item.command : "",
            exitCode: Number.isInteger(item.exit_code) ? item.exit_code : null,
            outputTail: tail(typeof item.aggregated_output === "string" ? item.aggregated_output : "", 4_000),
          });
        }
        break;
      case "mcp_tool_call":
        if (item.status === "failed" || item.error) {
          this.toolFailures.push({
            server: typeof item.server === "string" ? item.server : "",
            tool: typeof item.tool === "string" ? item.tool : "",
            message: normalizeMessage(item.error?.message ?? "MCP tool call failed"),
          });
        }
        break;
      case "error":
        this.streamErrors.push(normalizeMessage(item.message ?? "Codex item error"));
        break;
      default:
        break;
    }
  }

  #appendRawTail(text) {
    this.rawTail = tail(this.rawTail + text, this.maxRawTailChars);
  }
}

export function parseCodexExecJsonl(text, options) {
  const collector = new CodexJsonlCollector(options);
  collector.push(text);
  return collector.finish();
}

export function buildCodexHandoffReport(summary, stderr = "") {
  if (summary.finalAgentText.trim()) return summary.finalAgentText.trim();

  const parts = [];
  if (summary.turnFailed) parts.push(`Codex turn failed: ${summary.turnFailed}`);
  if (summary.streamErrors.length) parts.push(`Codex errors: ${summary.streamErrors.join(" | ")}`);
  if (stderr.trim()) parts.push(`stderr:\n${tail(stderr.trim(), 8_000)}`);
  if (!parts.length && summary.rawTail.trim()) parts.push(summary.rawTail.trim());
  return parts.join("\n\n") || "Codex produced no final agent message.";
}

function normalizeUsage(value) {
  if (!value || typeof value !== "object") return null;
  const keys = [
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
  ];
  const result = {};
  for (const key of keys) {
    if (Number.isFinite(value[key])) result[key] = value[key];
  }
  return Object.keys(result).length ? result : null;
}

function normalizeMessage(value) {
  return typeof value === "string" ? value : String(value ?? "");
}

function tail(value, maxChars) {
  if (value.length <= maxChars) return value;
  return value.slice(value.length - maxChars);
}
