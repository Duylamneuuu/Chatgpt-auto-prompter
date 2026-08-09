/**
 * UI-drift recovery boundary.
 *
 * This component is intentionally inert until it has bounded browser diagnostics
 * and a narrow recipe-update API. It must never receive arbitrary filesystem or
 * shell access as a way to repair Prompter itself.
 */
export class OpenAICompatibleUiHealer {
  constructor(options) {
    this.options = options;
  }

  async heal(error, context) {
    const diagnostic = {
      code: error?.code ?? "UNKNOWN_UI_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      cycle: context.cycle,
      phase: context.phase,
    };

    void this.options;
    void diagnostic;
    return false;
  }
}
