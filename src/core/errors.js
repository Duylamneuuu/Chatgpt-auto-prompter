export const ErrorCode = Object.freeze({
  CORE_INVARIANT_FAILED: "CORE_INVARIANT_FAILED",
  INVALID_SUPERVISOR_DECISION: "INVALID_SUPERVISOR_DECISION",
  INVALID_EXECUTOR_RESULT: "INVALID_EXECUTOR_RESULT",
  EXECUTOR_SPAWN_FAILED: "EXECUTOR_SPAWN_FAILED",
  EXECUTOR_TIMEOUT: "EXECUTOR_TIMEOUT",
  EXECUTOR_PROCESS_FAILED: "EXECUTOR_PROCESS_FAILED",
  BROWSER_UNAVAILABLE: "BROWSER_UNAVAILABLE",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  HUMAN_VERIFICATION_REQUIRED: "HUMAN_VERIFICATION_REQUIRED",
  PERMISSION_REQUIRED: "PERMISSION_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  THREAD_IDENTITY_UNVERIFIED: "THREAD_IDENTITY_UNVERIFIED",
  PROMPT_COMMIT_UNVERIFIED: "PROMPT_COMMIT_UNVERIFIED",
  RESPONSE_TIMEOUT: "RESPONSE_TIMEOUT",
  RESPONSE_COMPLETION_UNVERIFIED: "RESPONSE_COMPLETION_UNVERIFIED",
  UI_RECIPE_MISS: "UI_RECIPE_MISS",
  UI_HEAL_FAILED: "UI_HEAL_FAILED",
});

export class PrompterError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "PrompterError";
    this.code = code;
    this.details = options.details;
  }
}

export function toErrorInfo(error) {
  return {
    name: error?.name ?? "Error",
    code: typeof error?.code === "string" ? error.code : undefined,
    message: error?.message ?? String(error),
  };
}
