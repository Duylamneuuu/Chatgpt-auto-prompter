import { ErrorCode, PrompterError } from "./errors.js";

export function validateSupervisorDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidDecision("decision must be an object", value);
  }

  if (value.kind === "done") {
    if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
      throw invalidDecision("done.summary must be a non-empty string", value);
    }
    return value;
  }

  if (value.kind === "blocked") {
    if (typeof value.reason !== "string" || value.reason.trim().length === 0) {
      throw invalidDecision("blocked.reason must be a non-empty string", value);
    }
    if (value.code !== undefined && typeof value.code !== "string") {
      throw invalidDecision("blocked.code must be a string when provided", value);
    }
    return value;
  }

  if (value.kind === "next_task") {
    const task = value.task;
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      throw invalidDecision("next_task.task must be an object", value);
    }
    if (typeof task.id !== "string" || task.id.trim().length === 0) {
      throw invalidDecision("next_task.task.id must be a non-empty string", value);
    }
    if (typeof task.prompt !== "string" || task.prompt.trim().length === 0) {
      throw invalidDecision("next_task.task.prompt must be a non-empty string", value);
    }
    if (
      task.acceptanceCriteria !== undefined &&
      (!Array.isArray(task.acceptanceCriteria) ||
        task.acceptanceCriteria.some((item) => typeof item !== "string" || item.trim().length === 0))
    ) {
      throw invalidDecision("next_task.task.acceptanceCriteria must be an array of non-empty strings", value);
    }
    return value;
  }

  throw invalidDecision(`unsupported decision kind: ${String(value.kind)}`, value);
}

export function validateExecutorResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PrompterError(
      ErrorCode.INVALID_EXECUTOR_RESULT,
      "executor result must be an object",
      { details: { value } },
    );
  }

  if (!new Set(["completed", "failed", "blocked"]).has(value.status)) {
    throw new PrompterError(
      ErrorCode.INVALID_EXECUTOR_RESULT,
      `unsupported executor status: ${String(value.status)}`,
      { details: { value } },
    );
  }

  if (typeof value.report !== "string") {
    throw new PrompterError(
      ErrorCode.INVALID_EXECUTOR_RESULT,
      "executor result.report must be a string",
      { details: { value } },
    );
  }

  if (value.exitCode !== undefined && value.exitCode !== null && !Number.isInteger(value.exitCode)) {
    throw new PrompterError(
      ErrorCode.INVALID_EXECUTOR_RESULT,
      "executor result.exitCode must be an integer or null when provided",
      { details: { value } },
    );
  }

  return value;
}

function invalidDecision(message, value) {
  return new PrompterError(
    ErrorCode.INVALID_SUPERVISOR_DECISION,
    message,
    { details: { value } },
  );
}
