# Codex Handoff

## Product

**ChatGPT Auto Prompter** removes the manual relay:

```text
ChatGPT -> copy task -> Codex -> copy report -> ChatGPT -> ...
```

Target:

```text
Supervisor -> Prompter -> Codex -> Prompter -> Supervisor -> ... -> DONE
```

Prompter core is deterministic. ChatGPT/browser mechanics and Codex execution are adapters.

## Product North Star

**After initial setup and starting a run, the normal workflow must be fully automatic until `DONE` or a genuine hard blocker.**

Do not turn reliability/safety work into a manual copy/paste workflow. A solution that requires the user to move prompts or reports between ChatGPT and Codex by hand is not the target product.

Desired behavior:

```text
setup once
-> START
-> ChatGPT/supervisor automatically issues task
-> Codex automatically executes
-> Prompter automatically captures compact report/evidence
-> ChatGPT/supervisor automatically reviews
-> NEXT_TASK automatically loops
-> DONE automatically stops
```

Manual interaction is reserved for unavoidable external blockers such as login, human verification/CAPTCHA, explicit permission prompts, or genuinely ambiguous destructive actions. Those should pause/block safely. Once resolved, resume the autonomous run from durable state where practical.

## Do not research from zero

Read `docs/UPSTREAM_MINING.md` instead of scanning all upstream repositories. It already mines the useful patterns and exact relevant source files from:

- Oracle
- codex-chatgpt-control
- codex-chatgpt-web
- Stagehand
- Browser Harness
- OpenAI Codex

Only reopen upstream source for a specific unresolved implementation detail.

## Current state — 2026-08-09

Implemented:

### Core

- multi-cycle plan/execute/review loop;
- strict supervisor/executor protocols;
- structured errors;
- atomic checkpoint writes;
- max-cycle block and failure persistence;
- UI healer only on `UI_RECIPE_MISS`, one retry maximum.

### Codex executor

- `codex exec --json` adapter;
- incremental bounded JSONL collector using current Codex event shapes;
- captures final agent message, thread id, usage, changed files and bounded failure evidence;
- distinguishes recoverable command/MCP/item failures from fatal turn/stream failures;
- fails closed if JSON mode ends without `turn.completed`;
- real subprocess timeout handling including Windows process-tree termination path.

### Browser/supervisor contracts

- semantic `ChatGptSupervisor` independent of DOM/CDP;
- durable operation store;
- stable operation ids per plan/review cycle;
- committed prompt is never blindly submitted twice after UI-heal retry;
- unverified commit -> `PROMPT_COMMIT_UNVERIFIED`;
- unverified completion -> `RESPONSE_COMPLETION_UNVERIFIED`;
- strict JSON supervisor response parsing;
- default ChatGPT UI recipes outside protected core;
- data-only recipe store; unverified AI candidate cannot be persisted;
- pure response terminal classifier in `src/browser/response-gate.js`.

At this handoff snapshot the reconstructed committed code passes **32 Node tests**, including real child-process execution and timeout tests. Run `npm test` yourself before coding.

## Current task

GitHub **issue #1 — `V1: Implement minimal live ChatGPT CDP supervisor driver`** is the source of truth for the immediate milestone.

The existing semantic contract is:

```js
await driver.prepare({ operationId, input })
await driver.submit({ operationId, input, prompt, thread })
await driver.waitForResponse({ operationId, input, receipt, thread })
```

Do not redesign the state machine before implementing this unless a test demonstrates a real flaw.

## Required browser behavior

### `prepare()`

- attach to a user-controlled local Chrome/Chromium CDP endpoint;
- choose/verify the explicitly intended `chatgpt.com` conversation;
- verify usable signed-in/composer state;
- return bounded conversation identity;
- map hard blockers to structured codes.

### `submit()`

Follow the mined Oracle pattern:

```text
find visible composer from recipe
-> focus editor
-> insert prompt
-> read back / verify insertion
-> submit
-> positively verify a new user turn was committed
-> return committed receipt
```

A successful `click()` is not proof.

If submission may have occurred but commit cannot be proved, fail with `PROMPT_COMMIT_UNVERIFIED`; never blindly resend.

### `waitForResponse()`

Use `src/browser/response-gate.js`.

Browser code should produce samples for the expected assistant turn:

```js
{
  now,
  textLength,
  contentKey,
  stopVisible,
  terminalActionVisible,
  strongActivityVisible
}
```

Recommended observation strategy from upstream mining:

```text
DOM observer
   +
watchdog polling
   -> response-gate classifier
   -> positive terminal proof
```

Rules:

- scope to the expected turn/conversation;
- equal-length text rewrites still reset stability via `contentKey`;
- active generation/thinking vetoes completion;
- a transient action bar does not count;
- quiet text alone does not count;
- timeout without proof fails closed.

## UI recipe architecture

Bundled defaults:

`src/supervisors/chatgpt/default-recipes.js`

Runtime store:

`src/browser/ui-recipe-store.js`

Desired healing flow:

```text
known recipe works
-> zero LLM call

recipe miss
-> bounded DOM/AX diagnostics
-> optional mechanic model proposes declarative candidate
-> deterministic browser verification
-> UiRecipeStore.updateRecipe(..., { verified: true })
-> retry semantic action once
```

Never give the mechanic arbitrary Prompter source write/shell access for runtime repair.

## Error boundaries

Use existing codes rather than free-form strings:

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
UI_HEAL_FAILED
```

Only selector/AX/interaction recipe drift belongs to `UI_RECIPE_MISS`.

Examples:

```text
composer selector changed          -> UI_RECIPE_MISS
send control changed               -> UI_RECIPE_MISS
assistant locator changed          -> UI_RECIPE_MISS

signed out                         -> AUTH_REQUIRED
CAPTCHA / human verification       -> HUMAN_VERIFICATION_REQUIRED
rate limit                         -> RATE_LIMITED
wrong/stale conversation           -> THREAD_IDENTITY_UNVERIFIED
uncertain post-submit state        -> PROMPT_COMMIT_UNVERIFIED
cannot prove final response        -> RESPONSE_COMPLETION_UNVERIFIED
backend/core bug                   -> never UI_RECIPE_MISS
```

## What issue #1 must test

At minimum:

- deterministic composer selector fallback;
- structured recipe miss;
- text insertion read-back/postcondition;
- prompt commit positive proof;
- response gate sampling integration;
- auth/challenge/thread mismatch mappings;
- UI-heal retry after a committed prompt still submits exactly once;
- one explicit live same-conversation smoke path.

## Non-goals for issue #1

Do not add yet:

- model/effort picker automation;
- ChatGPT Work;
- Deep Research;
- file uploads;
- full vision computer-use fallback;
- GUI/dashboard;
- generic multi-agent framework;
- Codex app-server executor.

## After issue #1

1. durable automatic `prompter run` / `resume` flow with no manual message relay;
2. `prompter doctor` layered diagnostics;
3. bounded failure diagnostics (DOM/AX/screenshot only when useful);
4. optional OpenAI-compatible mechanic provider (9Router etc.) wired only to recipe recovery;
5. deterministic verifier/evidence hooks (tests/build/git diff/screenshots);
6. OpenCode executor adapter;
7. optional Codex app-server executor;
8. GUI after the headless zero-touch loop is dependable.

## Before handing off again

```text
npm test
```

Then confirm that the implementation still advances the **zero-touch automation North Star** rather than introducing a manual relay. Update this file only with facts actually implemented/tested. If new upstream research was necessary, add the reusable result to `docs/UPSTREAM_MINING.md` so the next agent does not spend context rediscovering it.
