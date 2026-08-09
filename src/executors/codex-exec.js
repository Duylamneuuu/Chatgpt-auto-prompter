import { spawn } from "node:child_process";
import { ErrorCode } from "../core/errors.js";
import { buildCodexHandoffReport, CodexJsonlCollector } from "./codex-jsonl.js";

const DEFAULT_STDERR_TAIL_CHARS = 16_000;

export class CodexExecExecutor {
  constructor(options) {
    this.options = options;
  }

  async execute(task) {
    const command = this.options.command ?? "codex";
    const args = this.options.args ?? ["exec", "--json", "--sandbox", "workspace-write"];
    const prompt = buildPrompt(task);
    const usesJson = args.includes("--json");

    return new Promise((resolve) => {
      const collector = usesJson
        ? new CodexJsonlCollector({ maxRawTailChars: this.options.maxRawTailChars })
        : null;
      let stdoutTail = "";
      let stderrTail = "";
      let timedOut = false;
      let settled = false;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      let child;
      try {
        child = spawn(command, [...args, prompt], {
          cwd: this.options.projectDir,
          shell: false,
          windowsHide: true,
          env: { ...process.env, ...(this.options.env ?? {}) },
        });
      } catch (error) {
        finish({
          status: "failed",
          errorCode: ErrorCode.EXECUTOR_SPAWN_FAILED,
          report: `Failed to start Codex: ${error.message}`,
          rawOutput: "",
          exitCode: null,
        });
        return;
      }

      const timer = this.options.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            terminateChildTree(child);
          }, this.options.timeoutMs)
        : undefined;

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk) => {
        if (collector) collector.push(chunk);
        else stdoutTail = appendTail(stdoutTail, chunk, this.options.maxRawTailChars ?? 24_000);
      });
      child.stderr.on("data", (chunk) => {
        stderrTail = appendTail(
          stderrTail,
          chunk,
          this.options.maxStderrTailChars ?? DEFAULT_STDERR_TAIL_CHARS,
        );
      });

      child.on("error", (error) => {
        if (timer) clearTimeout(timer);
        finish({
          status: "failed",
          errorCode: ErrorCode.EXECUTOR_SPAWN_FAILED,
          report: `Failed to start Codex: ${error.message}`,
          rawOutput: stderrTail,
          exitCode: null,
        });
      });

      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        if (settled) return;

        if (!collector) {
          const combined = [stdoutTail.trim(), stderrTail.trim()]
            .filter(Boolean)
            .join("\n\n[stderr]\n");
          finish({
            status: code === 0 && !timedOut ? "completed" : "failed",
            errorCode: timedOut
              ? ErrorCode.EXECUTOR_TIMEOUT
              : code === 0
                ? undefined
                : ErrorCode.EXECUTOR_PROCESS_FAILED,
            report: timedOut
              ? `Codex timed out.\n${combined}`
              : combined || "Codex produced no output.",
            rawOutput: combined,
            exitCode: code,
          });
          return;
        }

        const summary = collector.finish();
        const turnFailed = Boolean(summary.turnFailed || summary.streamErrors.length);
        const failed = timedOut || code !== 0 || turnFailed;
        const report = buildCodexHandoffReport(summary, stderrTail);

        finish({
          status: failed ? "failed" : "completed",
          errorCode: timedOut
            ? ErrorCode.EXECUTOR_TIMEOUT
            : code !== 0 || turnFailed
              ? ErrorCode.EXECUTOR_PROCESS_FAILED
              : undefined,
          report,
          rawOutput: summary.rawTail,
          exitCode: code,
          metadata: {
            threadId: summary.threadId,
            turnStarted: summary.turnStarted,
            turnCompleted: summary.turnCompleted,
            usage: summary.usage,
            changedFiles: summary.changedFiles,
            commandFailures: summary.commandFailures,
            toolFailures: summary.toolFailures,
            streamErrors: summary.streamErrors,
            invalidJsonlLines: summary.invalidLineCount,
            eventCount: summary.eventCount,
            stderrTail,
          },
        });
      });
    });
  }
}

function buildPrompt(task) {
  const criteria = task.acceptanceCriteria?.length
    ? `\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((item, i) => `${i + 1}. ${item}`).join("\n")}`
    : "";

  return `You are the executor in an autonomous supervisor loop.\n\nTask ID: ${task.id}\n\n${task.prompt}${criteria}\n\nWork directly in the current repository. Run relevant checks/tests. At the end, provide a concise handoff report containing: work completed, files changed, tests/checks run, failures, unresolved issues, and anything the supervisor should inspect next.`;
}

function appendTail(current, chunk, maxChars) {
  const value = current + String(chunk ?? "");
  return value.length <= maxChars ? value : value.slice(value.length - maxChars);
}

function terminateChildTree(child) {
  if (!child?.pid) return;

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.unref();
    return;
  }

  child.kill("SIGTERM");
  const forceTimer = setTimeout(() => {
    if (!child.killed) child.kill("SIGKILL");
  }, 2_000);
  forceTimer.unref?.();
}
