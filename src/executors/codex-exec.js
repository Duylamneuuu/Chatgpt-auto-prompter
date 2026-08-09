import { spawn } from "node:child_process";

export class CodexExecExecutor {
  constructor(options) {
    this.options = options;
  }

  async execute(task) {
    const command = this.options.command ?? "codex";
    const args = this.options.args ?? ["exec", "--json", "--sandbox", "workspace-write"];
    const prompt = buildPrompt(task);

    return new Promise((resolve) => {
      const child = spawn(command, [...args, prompt], {
        cwd: this.options.projectDir,
        shell: false,
        windowsHide: true,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = this.options.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            child.kill();
          }, this.options.timeoutMs)
        : undefined;

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));

      child.on("error", (error) => {
        if (timer) clearTimeout(timer);
        resolve({
          status: "failed",
          report: `Failed to start Codex: ${error.message}`,
          rawOutput: stderr,
          exitCode: null,
        });
      });

      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n\n[stderr]\n");
        resolve({
          status: code === 0 && !timedOut ? "completed" : "failed",
          report: timedOut ? `Codex timed out.\n${combined}` : combined || "Codex produced no output.",
          rawOutput: combined,
          exitCode: code,
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
