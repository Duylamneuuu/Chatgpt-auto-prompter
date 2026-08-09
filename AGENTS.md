# AGENTS.md

## Mission

Build **ChatGPT Auto Prompter**: a local autonomous supervisor/executor loop that removes the human copy/paste relay between a planning/review surface and a coding agent.

The target product experience is:

```text
user brainstorms / provides a brief
            |
            v
supervisor plans and issues one compact task
            |
            v
local coding agent executes in the target repo
            |
            v
Prompter collects a compact report + optional verification artifacts
            |
            v
supervisor reviews
      |             |
      |             +--> NEXT_TASK --> execute again
      +-----------------> DONE
```

Normal operation should be zero-touch after the run starts. Human intervention is acceptable for hard blockers such as authentication, CAPTCHA, permissions, or ambiguous destructive actions.

## Non-negotiable architecture boundaries

1. **The core is deterministic.** Do not put an LLM inside the state machine to decide whether internal invariants are valid.
2. **Supervisor != executor.** Keep both behind interfaces/adapters.
3. **UI healing is narrow.** AI may repair browser interaction recipes/selectors when the UI moves or changes. It must not rewrite Prompter core/backend code as a recovery strategy.
4. **Fail closed.** Unknown state, auth failure, CAPTCHA, corrupted checkpoint, or unsafe ambiguity must stop with a structured blocker.
5. **Do not automate around service safeguards.** No CAPTCHA bypass, rate-limit evasion, credential harvesting, hidden endpoint abuse, or access-control circumvention.
6. **Prefer observable postconditions over sleeps.** Browser actions must verify that the intended state change happened.
7. **Do not couple core logic to ChatGPT DOM details.** Those belong in a supervisor/browser adapter.
8. **Keep context compact.** Supervisor emits tasks; executor emits handoff reports. Do not blindly shuttle full terminal logs or full browser history every cycle.

## First implementation target

Do not attempt the full product at once. Work in this order:

### Phase A — make V0 solid

- deterministic run state machine;
- strict supervisor decision validation;
- checkpoint persistence;
- executor result schema;
- cancellation/timeouts;
- tests for happy path, block, crash, max cycles, malformed supervisor output;
- a disposable-repository integration test.

### Phase B — Codex executor

Use supported Codex non-interactive interfaces rather than scraping its TUI. Prefer structured output/events. The adapter should support:

- start task;
- timeout/cancel;
- collect final handoff report;
- distinguish process failure from task failure;
- later: resume/session support.

### Phase C — supervisor transport

Implement behind `Supervisor` interface. The core should not know whether the supervisor is:

- a supported API;
- a user-controlled browser adapter;
- Oracle-like transport;
- another local command.

The transport must return only a strict decision object.

### Phase D — UI drift recovery

Only after deterministic browser actions work:

```text
recipe works -> no AI
recipe fails -> collect DOM/accessibility/screenshot diagnostics
             -> optional mechanic model proposes a replacement recipe
             -> verify the recipe
             -> persist recipe
             -> retry once
```

Do not allow the mechanic to patch arbitrary source files.

## Suggested interfaces

```ts
interface Supervisor {
  decide(input: SupervisorInput): Promise<SupervisorDecision>
}

interface Executor {
  execute(task: ExecutorTask, context?: RunContext): Promise<ExecutorResult>
}

interface UiHealer {
  heal(failure: UiFailure, tools: BoundedBrowserTools): Promise<HealResult>
}
```

Supervisor decisions:

```ts
{ kind: 'next_task', task: { id, prompt, acceptanceCriteria? } }
{ kind: 'done', summary }
{ kind: 'blocked', reason, code? }
```

## State model

Aim for explicit durable states, not implicit control flow:

```text
IDLE
PLANNING
EXECUTING
VERIFYING
REVIEWING
RECOVERING_UI
BLOCKED
DONE
CANCELLED
FAILED
```

Every transition should be explainable in logs and recoverable from a checkpoint where reasonable.

## Verification philosophy

The supervisor should not accept success solely because the executor says "done". Add optional evidence hooks:

- command/test results;
- build result;
- git diff summary;
- screenshots for UI work;
- changed-file list;
- structured verifier output.

Keep evidence bounded and summarized before sending it back to the supervisor.

## Repository research

Before implementing a browser transport or healer from scratch, inspect `docs/REFERENCE_REPOS.md`. Reuse code only when licenses permit it and preserve required notices. Prefer taking patterns over creating hard dependencies.

## Quality bar

- Node.js 20+ initially.
- Minimize dependencies until a dependency clearly saves complexity.
- Tests are required for core state transitions.
- Avoid giant framework abstractions before the end-to-end loop works.
- Do not mark roadmap items complete without a real test.
- Keep Windows as a first-class target.

## When you are unsure

Preserve the boundaries above and implement the smallest end-to-end slice. Do not redesign the project into a generic multi-agent framework unless the current milestone requires it.
