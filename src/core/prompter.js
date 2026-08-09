export class Prompter {
  constructor(supervisor, executor, options = {}) {
    this.supervisor = supervisor;
    this.executor = executor;
    this.options = options;
    this.maxCycles = options.maxCycles ?? 10;
  }

  async run(brief) {
    let cycle = 0;
    await this.#persist({ version: 1, brief, cycle, state: "planning", updatedAt: now() });
    this.#emit({ type: "state", state: "planning", cycle });

    let decision = await this.#safeSupervisorDecision({ phase: "plan", brief, cycle: 0 }, cycle);
    this.#emit({ type: "decision", cycle, decision });

    while (decision.kind === "next_task") {
      if (cycle >= this.maxCycles) {
        const blocked = {
          kind: "blocked",
          reason: `Reached maxCycles=${this.maxCycles} before supervisor accepted the result.`,
        };
        await this.#persist({ version: 1, brief, cycle, state: "blocked", updatedAt: now() });
        return blocked;
      }

      cycle += 1;
      const task = decision.task;
      this.#emit({ type: "task", cycle, task });
      this.#emit({ type: "state", state: "executing", cycle });
      await this.#persist({ version: 1, brief, cycle, state: "executing", currentTask: task, updatedAt: now() });

      const result = await this.executor.execute(task);
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

      decision = await this.#safeSupervisorDecision({
        phase: "review",
        brief,
        cycle,
        previousTask: task,
        executorResult: result,
      }, cycle);
      this.#emit({ type: "decision", cycle, decision });
    }

    const state = decision.kind === "done" ? "done" : "blocked";
    this.#emit({ type: "state", state, cycle });
    await this.#persist({ version: 1, brief, cycle, state, updatedAt: now() });
    return decision;
  }

  async #safeSupervisorDecision(input, cycle) {
    try {
      return await this.supervisor.decide(input);
    } catch (error) {
      if (!this.options.uiHealer || error?.code !== "UI_RECIPE_MISS") throw error;
      this.#emit({ type: "state", state: "recovering_ui", cycle });
      const recovered = await this.options.uiHealer.heal(error, { cycle, phase: input.phase });
      if (!recovered) throw error;
      return this.supervisor.decide(input);
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
