# AGENTS.md

## Mission

Build **ChatGPT Auto Prompter**: a local autonomous supervisor/executor loop that removes the human copy/paste relay between a planning/review surface and a coding agent.

Target experience:

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

Normal operation should be zero-touch after the run starts. Human intervention is acceptable for hard blockers such as authentication, human-verification challenges, permissions, or ambiguous destructive actions.

## Read order for coding agents

Do **not** start by scanning upstream repositories.

Read, in order:

1. this file;
2. `docs/CODEX_HANDOFF.md`;
3. `docs/UPSTREAM_MINING.md`;
4. the code/tests relevant to the current milestone.

`docs/UPSTREAM_MINING.md` already mines the important implementation patterns and exact source files from Oracle, codex-chatgpt-control, codex-chatgpt-web, Stagehand, Browser Harness, and OpenAI Codex. Only open upstream source when that digest explicitly leaves a concrete gap.

## Current implementation snapshot — 2026-08-09

Already implemented:

- deterministic multi-cycle supervisor/executor loop;
- central supervisor/executor protocol validation;
- structured error taxonomy;
- atomic checkpoint writes;
- max-cycle safe block;
- failure persistence/events;
- UI healer limited to `UI_RECIPE_MISS` and exactly one retry;
- bounded Codex `exec --json` JSONL collector;
- final Codex agent-message extraction + compact execution metadata;
- semantic `ChatGptSupervisor` contract independent of DOM/CDP;
- durable supervisor operation store so a committed browser prompt is not submitted twice after retry/restart;
- data-only UI recipe store that refuses unverified AI-generated updates;
- default ChatGPT selector recipes kept outside the core.

The reconstructed committed snapshot has been exercised with **24 passing Node tests**. Always run `npm test` yourself before and after changes.

## Non-negotiable architecture boundaries

1. **The core is deterministic.** Do not put an LLM inside the state machine to decide whether internal invariants are valid.
2. **Supervisor != executor.** Keep both behind interfaces/adapters.
3. **UI healing is narrow.** AI may repair browser interaction recipes/selectors when the UI moves or changes. It must not rewrite Prompter core/backend code as a recovery strategy.
4. **Fail closed.** Unknown state, auth failure, human-verification challenge, corrupted checkpoint, or unsafe ambiguity must stop with a structured blocker.
5. **Do not automate around service safeguards.** No CAPTCHA bypass, rate-limit evasion, credential harvesting, hidden endpoint abuse, or access-control circumvention.
6. **Prefer observable postconditions over sleeps.** Browser actions must prove the intended state change happened.
7. **Do not couple core logic to ChatGPT DOM details.** Those belong in the ChatGPT browser driver/recipes.
8. **Keep context compact.** Supervisor emits tasks; executor emits handoff reports. Do not blindly shuttle full terminal logs or browser history every cycle.
9. **No duplicate browser submissions.** A timeout or UI-heal retry is never permission to blindly send the same prompt again.
10. **Runtime-learned UI state is data.** Mechanic AI proposes a bounded recipe candidate; deterministic code verifies it before persistence.

## Immediate next milestone

The next major task is **a minimal live ChatGPT CDP driver** behind the already-existing `ChatGptSupervisor` semantic contract.

Do not redesign the core first.

Implement only enough browser functionality to satisfy:

```text
prepare()
  -> attach to a user-controlled Chrome session
  -> identify/verify the intended ChatGPT conversation

submit()
  -> locate a visible composer from recipes
  -> insert prompt reliably
  -> submit
  -> positively prove a new user turn was committed
  -> return { committed: true, ...receipt }

waitForResponse()
  -> watch the corresponding assistant turn
  -> positively prove completion
  -> return { complete: true, text, responseId }
```

### Browser completion rules

Do **not** use `text stable for N seconds` as the sole completion condition. Follow `docs/UPSTREAM_MINING.md`:

- observer + polling/watchdog paths are desirable;
- scope to the expected turn/conversation;
- content rewrites reset stability, even if length is unchanged;
- visible/strong working signals veto completion;
- require positive terminal evidence;
- if completion cannot be proved, fail closed with `RESPONSE_COMPLETION_UNVERIFIED` or `RESPONSE_TIMEOUT`.

### Browser error mapping

Map known conditions into existing codes rather than random strings:

```text
BROWSER_UNAVAILABLE
AUTH_REQUIRED
HUMAN_VERIFICATION_REQUIRED
PERMISSION_REQUIRED
RATE_LIMITED
SERVICE_UNAVAILABLE
THREAD_IDENTITY_UNVERIFIED
PROMPT_COMMIT_UNVERIFIED
RESPONSE_TIMEOUT
RESPONSE_COMPLETION_UNVERIFIED
UI_RECIPE_MISS
```

Only `UI_RECIPE_MISS` is eligible for the UI healer.

## After the minimal CDP driver

Work in this order:

1. live smoke test against an explicitly chosen ChatGPT conversation;
2. `prompter doctor` diagnostics;
3. durable `prompter run` / `prompter resume` without duplicate submission;
4. bounded UI diagnostics (DOM/AX/screenshot only when needed);
5. mechanic provider connected to the data-only recipe store;
6. optional verifier hooks: tests/build/git diff/screenshots;
7. only then consider a Codex app-server executor, OpenCode executor, richer UI, model selection, attachments, or vision fallback.

## Existing interfaces / intent

Supervisor decisions:

```js
{ kind: "next_task", task: { id, prompt, acceptanceCriteria? } }
{ kind: "done", summary }
{ kind: "blocked", reason, code? }
```

Executor result minimum:

```js
{
  status: "completed" | "failed" | "blocked",
  report: "compact handoff",
  exitCode: 0 | null
}
```

ChatGPT semantic driver contract is consumed by `src/supervisors/chatgpt/chatgpt-supervisor.js`:

```js
await driver.prepare({ operationId, input })
await driver.submit({ operationId, input, prompt, thread })
await driver.waitForResponse({ operationId, input, receipt, thread })
```

A committed operation is stored before waiting. Respect this invariant.

## Verification philosophy

The supervisor should not accept success solely because the executor says "done". Add optional evidence hooks later:

- command/test results;
- build result;
- git diff summary;
- screenshots for UI work;
- changed-file list;
- structured verifier output.

Keep evidence bounded and summarized before sending it back to the supervisor.

## Quality bar

- Node.js 20+ initially.
- Windows is a first-class target.
- Minimize dependencies until a dependency clearly removes more complexity than it adds.
- Tests are required for state transitions and retry/idempotency behavior.
- Avoid giant framework abstractions before the end-to-end loop works.
- Do not mark roadmap items complete without a real test.
- Preserve zero-touch normal operation, but fail closed on hard blockers.

## When unsure

Preserve the boundaries above and implement the smallest testable end-to-end slice. Do not redesign the project into a generic multi-agent framework. Do not reread all upstream repos: use `docs/UPSTREAM_MINING.md` first.
