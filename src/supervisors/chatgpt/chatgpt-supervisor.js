import { ErrorCode, PrompterError } from "../../core/errors.js";
import { validateSupervisorDecision } from "../../core/protocol.js";
import { MemoryOperationStore } from "../operation-store.js";

/**
 * Semantic ChatGPT supervisor adapter.
 *
 * This module deliberately knows nothing about selectors or CDP. The injected
 * driver owns browser mechanics. The operation store makes retries idempotent:
 * once a prompt is confirmed committed, re-entering decide() resumes that
 * operation instead of submitting the same prompt again.
 */
export class ChatGptSupervisor {
  constructor(options) {
    this.driver = options.driver;
    this.operationStore = options.operationStore ?? new MemoryOperationStore();
    this.promptBuilder = options.promptBuilder ?? buildSupervisorPrompt;
  }

  async decide(input) {
    const operationId = operationIdFor(input);
    let operation = await this.operationStore.get(operationId);

    if (!operation) {
      operation = {
        version: 1,
        operationId,
        state: "prepared",
        createdAt: new Date().toISOString(),
      };
      await this.operationStore.set(operationId, operation);
    }

    if (operation.state === "captured") {
      return parseSupervisorDecisionText(operation.responseText);
    }

    if (operation.state === "prepared") {
      const thread = await this.driver.prepare({ operationId, input });
      const prompt = this.promptBuilder(input, { operationId });
      const receipt = await this.driver.submit({ operationId, input, prompt, thread });

      if (!receipt || receipt.committed !== true) {
        throw new PrompterError(
          ErrorCode.PROMPT_COMMIT_UNVERIFIED,
          "Supervisor browser driver could not prove that the prompt was committed.",
          { details: { operationId } },
        );
      }

      operation = {
        ...operation,
        state: "committed",
        thread: sanitizeReceiptThread(thread),
        receipt,
        committedAt: new Date().toISOString(),
      };
      await this.operationStore.set(operationId, operation);
    }

    if (operation.state !== "committed") {
      throw new PrompterError(
        ErrorCode.CORE_INVARIANT_FAILED,
        `Unsupported supervisor operation state: ${String(operation.state)}`,
        { details: { operationId, state: operation.state } },
      );
    }

    const response = await this.driver.waitForResponse({
      operationId,
      input,
      receipt: operation.receipt,
      thread: operation.thread,
    });

    if (!response || response.complete !== true || typeof response.text !== "string") {
      throw new PrompterError(
        ErrorCode.RESPONSE_COMPLETION_UNVERIFIED,
        "Supervisor browser driver could not positively confirm a complete response.",
        { details: { operationId } },
      );
    }

    operation = {
      ...operation,
      state: "captured",
      responseId: response.responseId ?? null,
      responseText: response.text,
      capturedAt: new Date().toISOString(),
    };
    await this.operationStore.set(operationId, operation);

    return parseSupervisorDecisionText(response.text);
  }
}

export function operationIdFor(input) {
  const phase = input?.phase === "review" ? "review" : "plan";
  const cycle = Number.isInteger(input?.cycle) ? input.cycle : 0;
  return `${phase}:${cycle}`;
}

export function parseSupervisorDecisionText(text) {
  if (typeof text !== "string") {
    throw new PrompterError(
      ErrorCode.INVALID_SUPERVISOR_DECISION,
      "Supervisor response must be text containing exactly one decision JSON object.",
    );
  }

  let candidate = text.trim();
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidate = fenced[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new PrompterError(
      ErrorCode.INVALID_SUPERVISOR_DECISION,
      "Supervisor response was not strict JSON.",
      { cause: error },
    );
  }

  return validateSupervisorDecision(parsed);
}

export function buildSupervisorPrompt(input, { operationId } = {}) {
  const protocol = `Return exactly one JSON object and no prose outside it.\n\nAllowed decisions:\n{\"kind\":\"next_task\",\"task\":{\"id\":\"...\",\"prompt\":\"...\",\"acceptanceCriteria\":[\"...\"]}}\n{\"kind\":\"done\",\"summary\":\"...\"}\n{\"kind\":\"blocked\",\"reason\":\"...\",\"code\":\"optional\"}`;

  if (input.phase === "plan") {
    return `You are the planner/reviewer supervising a local coding agent. Convert the user's brief into the single best next coding task. Do not claim implementation happened yet.\n\nOperation: ${operationId}\n\nUSER BRIEF:\n${input.brief}\n\n${protocol}`;
  }

  return `You are reviewing the latest result from a local coding agent. Decide whether the product is good enough for the user's brief. If more work is needed, issue exactly one concrete next task. If the result is satisfactory, return done. If progress is impossible without human action, return blocked.\n\nOperation: ${operationId}\n\nUSER BRIEF:\n${input.brief}\n\nPREVIOUS TASK:\n${JSON.stringify(input.previousTask, null, 2)}\n\nEXECUTOR RESULT:\n${JSON.stringify(input.executorResult, null, 2)}\n\n${protocol}`;
}

function sanitizeReceiptThread(thread) {
  if (!thread || typeof thread !== "object") return thread ?? null;
  return {
    conversationId: typeof thread.conversationId === "string" ? thread.conversationId : null,
    conversationUrl: typeof thread.conversationUrl === "string" ? thread.conversationUrl : null,
  };
}
