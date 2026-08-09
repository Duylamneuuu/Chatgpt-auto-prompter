# Codex Handoff

This is the implementation handoff for the next coding agent.

## Product in one sentence

A local deterministic orchestrator lets a planning/review supervisor repeatedly task a coding agent, receive a compact handoff, and continue until accepted — removing the human copy/paste relay.

## Architecture

```text
Supervisor (planner/reviewer)
          |
          v
Prompter deterministic core
          |
          v
Executor (Codex first)
          |
          +---- compact report ----> Supervisor
```

Optional browser transport:

```text
ChatGptSupervisor (semantic contract)
          |
          v
ChatGPT browser driver / UI recipes
          |
          +---- UI_RECIPE_MISS ----> bounded UI healer
```

The healer is not a backend repair agent.

## Research is already done

**Do not spend a context window reading six upstream repositories.**

Read `docs/UPSTREAM_MINING.md`. It contains the mined implementation patterns, exact upstream files worth knowing, what to copy conceptually, what not to copy, and the concrete implementation order from:

- `steipete/oracle`
- `adamallcock/codex-chatgpt-control`
- `miuuyy/codex-chatgpt-web`
- `browserbase/stagehand`
- `browser-use/browser-harness`
- `openai/codex`

Open upstream source only if the digest identifies a concrete missing implementation detail.

## What is already implemented

As of 2026-08-09:

### Core

- multi-cycle `plan -> execute -> review -> next_task/done/blocked` loop;
- central `SupervisorDecision` validation;
- central `ExecutorResult` validation;
- structured error taxonomy;
- failure checkpointing/events;
- max-cycle safe block;
- atomic JSON checkpoint writes;
- UI healer may run only for `UI_RECIPE_MISS` and only once per failed supervisor decision.

### Codex executor

- non-interactive `codex exec --json` scaffold;
- incremental/bounded JSONL collector using Codex's published event shapes;
- tracks thread id, turn state, usage, final agent message, changed files, command failures, MCP tool failures and stream errors;
- raw transcript storage is bounded rather than forwarding unlimited terminal output to the supervisor;
- Windows process-tree timeout termination is scaffolded.

### Supervisor/browser safety contracts

- `ChatGptSupervisor` exists as a semantic adapter independent of selectors/CDP;
- durable supervisor operation store exists;
- operation id is stable per `plan/review + cycle`;
- once a browser prompt is positively committed, retries resume waiting and do not submit it again;
- unverified commit fails closed;
- unverified response completion fails closed;
- strict supervisor JSON parsing;
- data-only UI recipe store;
- an AI-proposed recipe cannot be persisted until deterministic code marks it verified;
- bundled current ChatGPT selector recipes exist outside the core.

### Tests

The reconstructed committed snapshot currently passes **24 Node tests** covering the above core/idempotency/recipe/JSONL behavior. Run `npm test` immediately after checkout; do not trust the number if the repository has since changed.

## Immediate next task

Implement the **minimal live ChatGPT CDP driver** consumed by:

`src/supervisors/chatgpt/chatgpt-supervisor.js`

The existing semantic contract is:

```js
await driver.prepare({ operationId, input })
await driver.submit({ operationId, input, prompt, thread })
await driver.waitForResponse({ operationId, input, receipt, thread })
```

Do not redesign this unless a test demonstrates a real flaw.

### Required V1 behavior

#### `prepare()`

- connect to a user-controlled local Chrome/Chromium CDP endpoint;
- select or attach to an explicitly intended `chatgpt.com` tab/conversation;
- verify the page is actually usable;
- verify signed-in/composer state;
- return bounded thread identity such as conversation id/url;
- map login/challenge/unknown states to structured blockers.

#### `submit()`

- load the current UI recipe;
- locate a visible editable composer using deterministic recipes first;
- insert prompt in a way React/Lexical/ProseMirror actually registers;
- read back enough state to prove the prompt landed;
- submit;
- **positively prove that a new user turn corresponding to this operation was committed**;
- only then return:

```js
{
  committed: true,
  submissionId: "...",
  conversationId: "..."
}
```

If a click happened but commit cannot be proven, return/throw `PROMPT_COMMIT_UNVERIFIED`. Do not blindly retry the submit.

#### `waitForResponse()`

- wait for the assistant turn corresponding to the committed submission;
- use an observer plus polling/watchdog strategy where practical;
- track content changes by fingerprint, not just length;
- active/strong thinking or generation controls veto completion;
- require positive terminal evidence (e.g. terminal action bar/control + stable content);
- refuse to return a likely partial preamble;
- on success return:

```js
{
  complete: true,
  responseId: "...",
  text: "..."
}
```

A simple `sleep(5000)` or `text unchanged for N seconds` implementation is not sufficient.

## Error mapping

Use existing machine-readable codes:

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

### Healable vs non-healable

Only interaction-recipe drift should map to:

```text
UI_RECIPE_MISS
```

Examples:

```text
composer selector no longer exists        -> UI_RECIPE_MISS
send control changed                      -> UI_RECIPE_MISS
assistant-turn locator changed            -> UI_RECIPE_MISS

not signed in                             -> AUTH_REQUIRED
human verification / CAPTCHA              -> HUMAN_VERIFICATION_REQUIRED
rate limited                              -> RATE_LIMITED
wrong/stale conversation                  -> THREAD_IDENTITY_UNVERIFIED
click may have submitted, but unsure      -> PROMPT_COMMIT_UNVERIFIED
response cannot be proven complete        -> RESPONSE_COMPLETION_UNVERIFIED
core/checkpoint invariant broken          -> never UI_RECIPE_MISS
```

## UI recipes

Bundled defaults live in:

`src/supervisors/chatgpt/default-recipes.js`

Runtime learned recipes should live under `.prompter/` and be managed by `UiRecipeStore`.

Desired runtime flow:

```text
known recipe
    |
    +-- works --> continue with zero LLM call
    |
    +-- recipe miss
            |
            v
       diagnostics
            |
            v
     optional mechanic AI
            |
       candidate recipe
            |
            v
 deterministic verification
            |
      +-----+------+
      |            |
   success       failure
      |            |
 persist        fail closed
      |
 retry semantic action once
```

The mechanic must not receive arbitrary Prompter source-write access.

## Browser implementation guidance mined upstream

Do not re-research broadly. The high-value lessons are already condensed here:

### From Oracle

- multiple visible composer candidates;
- focus/click before text insertion;
- verify inserted text;
- fallback input events for framework editors;
- verify prompt commit after submit;
- observer + polling response capture;
- positive terminal proof, not quiet-time guessing;
- preserve diagnostics on timeout/failure.

### From codex-chatgpt-control

- semantic controls above selectors;
- mutation followed by postcondition read-back;
- start/status/wait style operations to avoid duplicate requests;
- structured blockers;
- verify conversation identity before follow-up.

### From codex-chatgpt-web

- current fallback selector families;
- visible composer as an authentication signal;
- stable presence/absence probes;
- doctor/smoke-test separation by layer.

### From Stagehand

- replay deterministic known actions;
- if an action self-heals into a changed selector/action, verify it then refresh the cache;
- do not pay for an LLM on healthy repeated workflows.

### From Browser Harness

- accessibility tree first for semantic discovery when selectors fail;
- raw DOM second;
- screenshot when visual/layout evidence is actually needed;
- store site-specific learned behavior outside protected core code.

### From Codex

- keep V1 on supported non-interactive execution;
- later `codex app-server` offers explicit Thread/Turn/Item lifecycle and durable resume.

See `docs/UPSTREAM_MINING.md` for exact upstream file paths and deeper notes.

## After live CDP works

Work queue:

1. integration test/smoke test against an explicitly chosen conversation;
2. `prompter doctor` that checks each layer independently;
3. durable CLI `run` / `resume` using `FileOperationStore`;
4. bounded browser diagnostics;
5. UI healer candidate schema + configurable OpenAI-compatible mechanic endpoint;
6. deterministic verifier/evidence hooks (git diff/tests/build/screenshots);
7. optional OpenCode executor;
8. optional Codex app-server executor;
9. dashboard/GUI only after the headless workflow is dependable.

## Do not build yet

- generic LangChain/LangGraph framework;
- model marketplace;
- ChatGPT Work support;
- model/effort picker automation;
- Deep Research;
- attachment pipeline;
- broad vision computer-use fallback;
- arbitrary self-modifying mechanic agent;
- CAPTCHA bypasses or rate-limit workarounds.

They are not necessary to prove the core product.

## Before finishing any task

Always:

```text
1. npm test
2. add/update tests for new invariants
3. update this handoff if the next task materially changes
4. keep docs/UPSTREAM_MINING.md current if a new upstream lesson was actually needed
```

The near-term definition of success is simple: a user should eventually be able to start Prompter once, then watch ChatGPT supervisor and Codex exchange task/report cycles without manual copy/paste and without duplicate browser submissions.
