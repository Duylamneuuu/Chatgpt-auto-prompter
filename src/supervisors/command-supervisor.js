import { spawn } from "node:child_process";

/**
 * Adapter boundary for a supported API, local command, or experimental browser bridge.
 * The child receives SupervisorInput JSON on stdin and must print exactly one decision JSON.
 */
export class CommandSupervisor {
  constructor(options) {
    this.options = options;
  }

  decide(input) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.options.command, this.options.args ?? [], {
        cwd: this.options.cwd,
        shell: false,
        windowsHide: true,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      const finishReject = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const finishResolve = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const timer = this.options.timeoutMs
        ? setTimeout(() => {
            child.kill();
            finishReject(new Error(`Supervisor command timed out after ${this.options.timeoutMs}ms`));
          }, this.options.timeoutMs)
        : undefined;

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", finishReject);
      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        if (settled) return;
        if (code !== 0) {
          finishReject(new Error(`Supervisor command exited ${code}: ${stderr.trim()}`));
          return;
        }
        try {
          finishResolve(validateDecision(JSON.parse(stdout)));
        } catch (error) {
          finishReject(new Error(`Invalid supervisor JSON: ${error.message}\nRaw output:\n${stdout}`));
        }
      });

      child.stdin.end(JSON.stringify(input));
    });
  }
}

export function validateDecision(value) {
  if (!value || typeof value !== "object") throw new Error("decision must be an object");
  if (value.kind === "done" && typeof value.summary === "string") return value;
  if (value.kind === "blocked" && typeof value.reason === "string") return value;
  if (value.kind === "next_task") {
    if (value.task && typeof value.task.id === "string" && typeof value.task.prompt === "string") {
      return value;
    }
  }
  throw new Error(`unsupported decision: ${JSON.stringify(value)}`);
}
