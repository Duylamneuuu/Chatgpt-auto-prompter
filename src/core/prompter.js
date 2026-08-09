import { ErrorCode, PrompterError, toErrorInfo } from "./errors.js";
import { validateExecutorResult, validateSupervisorDecision } from "./protocol.js";

export class Prompter {
  constructor(supervisor, executor, options = {}) {
    this.supervisor = supervisor;
    this.executor = executor;
    this.options = options;
    this.maxCycles = options.maxCycles ?? 10;
  }

  async run(brief) {
    try {
      return await this.#runInternal(brief);
    } catch (error) {
      this.#emit({ type: "state", state: "failed" });
      this.#emit({ type: "error", error: toErrorInfo(error) });
      await this.#persist({
        version: 1,
        brief,
        state: "failed",
        error: toErrorInfo(error),
        updatedAt: now(),
      });
      throw error;
    }
  }

  async #runInternal(brief) {
    let cycle = 0;
    await this.#persist({ version: 1, brief, cycle, state: "planning", updatedAt: now() });
    this.#emit({ type: "state", state: "planning", cycle });

    let decision = await this.#safeSupervisorDecision({ phase: "plan", brief, cycle: 0 }, cycle);
    this.#emit({ type: "decision", cycle, decision });

    while (decision.kind === "next_task") {
      if (cycle >= this.maxCycles) {
        const blocked = {
          kind: "blocked",
          code: "MAX_CYCLES_REACHED",
          reason: `Reached maxCycles=${this.maxCycles} before supervisor accepted the result.`,
        };
        this.#emit({ type: "state", state: "blocked", cycle });
        await this.#persist({
          version: 1,
          brief,
          cycle,
          state: "blocked",
          decision: blocked,
          updatedAt: now(),
        });
        return blocked;
      }

      cycle += 1;
      const task = decision.task;
      this.#emit({ type: "task", cycle, task });
      this.#emit({ type: "state", state: "executing", cycle });
      await this.#persist({
        version: 1,
        brief,
        cycle,
        state: "executing",
        currentTask: task,
        updatedAt: now(),
      });

      const result = validateExecutorResult(await this.executor.execute(task));
      this.#emit({ type: "result", cycle, result });

      this.#emit({ type: "state", state: "reviewing", cycle });
      await this.#persist({
        version: 1,
        brief,
        cycle,
        state: "reviewing",
        currentTask: task,
        lastResult: result,
        updatedAt: now(),
      });

      decision = await this.#safeSupervisorDecision(
        {
          phase: "review",
          brief,
          cycle,
          previousTask: task,
          executorResult: result,
        },
        cycle,
      );
      this.#emit({ type: "decision", cycle, decision });
    }

    const state = decision.kind === "done" ? "done" : "blocked";
    this.#emit({ type: "state", state, cycle });
    await this.#persist({
      version: 1,
      brief,
      cycle,
      state,
      decision,
      updatedAt: now(),
    });
    return decision;
  }

  async #safeSupervisorDecision(input, cycle) {
    try {
      return validateSupervisorDecision(await this.supervisor.decide(input));
    } catch (error) {
      if (!this.options.uiHealer || error?.code !== ErrorCode.UI_RECIPE_MISS) {
        throw error;
      }

      this.#emit({ type: "state", state: "recovering_ui", cycle });
      this.#emit({ type: "ui_heal_started", cycle, phase: input.phase, error: toErrorInfo(error) });
      await this.#persist({
        version: 1,
        cycle,
        state: "recovering_ui",
        error: toErrorInfo(error),
        phase: input.phase,
        updatedAt: now(),
      });

      let recovered;
      try {
        recovered = await this.options.uiHealer.heal(error, {
          cycle,
          phase: input.phase,
        });
      } catch (healError) {
        throw new PrompterError(
          ErrorCode.UI_HEAL_FAILED,
          `UI healer failed: ${healError?.message ?? String(healError)}`,
          { cause: healError },
        );
      }

      if (!recovered) {
        throw new PrompterError(
          ErrorCode.UI_HEAL_FAILED,
          "UI healer could not produce a verified recovery.",
          { cause: error },
        );
      }

      this.#emit({ type: "ui_heal_succeeded", cycle, phase: input.phase });

      // Exactly one retry. If the repaired recipe is still wrong, surface the
      // second error instead of recursively invoking the healer.
      return validateSupervisorDecision(await this.supervisor.decide(input));
    }
  }

  async #persist(checkpoint) {
    await this.options.checkpointStore?.save(checkpoint);
  }

  #emit(event) {
    this.options.onEvent?.(event);
  }
}

function now() {
  return new Date().toISOString();
}
