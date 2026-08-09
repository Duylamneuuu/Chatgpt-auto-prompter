import { spawn } from "node:child_process";
import { ErrorCode, PrompterError } from "../core/errors.js";
import { validateSupervisorDecision } from "../core/protocol.js";

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
        env: { ...process.env, ...(this.options.env ?? {}) },
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
            finishReject(
              new PrompterError(
                ErrorCode.SERVICE_UNAVAILABLE,
                `Supervisor command timed out after ${this.options.timeoutMs}ms`,
              ),
            );
          }, this.options.timeoutMs)
        : undefined;

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", (error) => {
        if (timer) clearTimeout(timer);
        finishReject(
          new PrompterError(
            ErrorCode.SERVICE_UNAVAILABLE,
            `Failed to start supervisor command: ${error.message}`,
            { cause: error },
          ),
        );
      });
      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        if (settled) return;
        if (code !== 0) {
          finishReject(
            new PrompterError(
              ErrorCode.SERVICE_UNAVAILABLE,
              `Supervisor command exited ${code}: ${stderr.trim()}`,
              { details: { exitCode: code } },
            ),
          );
          return;
        }
        try {
          finishResolve(validateSupervisorDecision(JSON.parse(stdout)));
        } catch (error) {
          if (error instanceof PrompterError) {
            finishReject(error);
            return;
          }
          finishReject(
            new PrompterError(
              ErrorCode.INVALID_SUPERVISOR_DECISION,
              `Invalid supervisor JSON: ${error.message}`,
              { cause: error, details: { rawOutput: stdout } },
            ),
          );
        }
      });

      child.stdin.end(JSON.stringify(input));
    });
  }
}

// Backward-compatible export for the early V0 API.
export const validateDecision = validateSupervisorDecision;
