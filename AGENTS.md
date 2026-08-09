# AGENTS.md

## Mission

Build **ChatGPT Auto Prompter**: a local autonomous supervisor/executor loop that removes the human copy/paste relay between a planning/review surface and a coding agent.

```text
user brief / brainstorm
        ↓
supervisor plans one task
        ↓
Prompter deterministic core
        ↓
Codex executes
        ↓
compact report
        ↓
supervisor reviews
   ├─ NEXT_TASK → repeat
   ├─ DONE
   └─ BLOCKED
```

## NORTH STAR — DO NOT DILUTE THIS

**The product must be fully automatic after initial setup/start.** The user should not have to copy prompts, paste reports, click "continue", shuttle messages between ChatGPT and Codex, or manually trigger each loop iteration.

The intended steady-state experience is:

```text
one-time setup
-> user starts a run
-> supervisor sends task automatically
-> executor works automatically
-> Prompter returns evidence/report automatically
-> supervisor reviews automatically
-> NEXT_TASK loops automatically
-> DONE stops automatically
```

A design that requires the user to manually copy/paste between supervisor and executor is **not an acceptable final implementation**; it defeats the purpose of the project. Manual interaction is permitted only for unavoidable external hard blockers such as authentication, human verification/CAPTCHA, explicit permissions, or genuinely ambiguous destructive actions. Once such a blocker is resolved, the run should be able to resume automation rather than fall back to a permanent manual workflow.

Safety and reliability work must preserve this automation goal. Do not "solve" browser instability by turning the product into a manual relay.

Normal operation should therefore be zero-touch after start.

## Read order

Do **not** scan upstream repositories first.

1. `AGENTS.md`
2. `docs/CODEX_HANDOFF.md`
3. `docs/UPSTREAM_MINING.md`
4. relevant source/tests
5. GitHub issue #1 for the current V1 browser milestone

`docs/UPSTREAM_MINING.md` already extracts the useful code patterns and exact files from Oracle, codex-chatgpt-control, codex-chatgpt-web, Stagehand, Browser Harness, and OpenAI Codex. Read upstream only for a concrete unresolved gap.

## Current implementation snapshot — 2026-08-09

Implemented:

- deterministic multi-cycle supervisor/executor loop;
- strict supervisor/executor protocol validation;
- structured error taxonomy;
- atomic checkpoints;
- failure persistence/events and max-cycle safe block;
- UI healer limited to `UI_RECIPE_MISS` and one retry;
- bounded `codex exec --json` event collector;
- final Codex message + compact evidence extraction;
- real child-process timeout behavior;
- semantic `ChatGptSupervisor` independent of DOM/CDP;
- durable operation state preventing duplicate committed prompts after retry/restart;
- data-only UI recipe store that refuses unverified AI candidates;
- default ChatGPT UI recipes outside core code;
- pure positive-proof response terminal classifier.

At this handoff snapshot the reconstructed repo passes **32 Node tests**. Trust `npm test` over this number if the repo has changed.

## Non-negotiable boundaries

1. **Automation is the product.** After setup/start, supervisor ↔ Prompter ↔ executor must run without human message relaying.
2. **Core is deterministic.** Never use an LLM to repair or validate internal core invariants.
3. **Supervisor and executor stay behind adapters.**
4. **DOM/CDP details never leak into core.**
5. **UI healing is narrow.** AI may propose a selector/AX recipe; deterministic code must verify it before persistence.
6. **Mechanic AI does not rewrite Prompter source/backend as recovery.**
7. **Fail closed.** Unknown state is not success.
8. **No duplicate browser submissions.** Timeout/retry is never permission to blindly resend a committed prompt.
9. **Positive postconditions beat sleeps.** A click is not proof; stable text alone is not proof of completion.
10. **Keep context bounded.** Do not forward unlimited browser/terminal logs to the supervisor.
11. **Do not bypass safeguards.** No CAPTCHA bypass, credential harvesting, hidden-endpoint abuse, rate-limit evasion, or access-control circumvention.
12. **Hard blockers pause; they do not redefine the product as manual.** After the blocker is resolved, automation should resume from durable state where possible.

## Immediate next milestone

Implement the **minimal live ChatGPT CDP driver** required by GitHub issue #1 and consumed by:

`src/supervisors/chatgpt/chatgpt-supervisor.js`

Existing semantic calls:

```js
await driver.prepare({ operationId, input })
await driver.submit({ operationId, input, prompt, thread })
await driver.waitForResponse({ operationId, input, receipt, thread })
```

Do not redesign the core before implementing this driver unless a failing test demonstrates a real architectural flaw.

### `prepare()`

- attach to a user-controlled local Chrome/Chromium CDP endpoint;
- identify an explicitly intended `chatgpt.com` tab/conversation;
- verify the page/composer is usable;
- return bounded conversation identity;
- map auth/challenge/wrong-page conditions to structured errors.

### `submit()`

- load deterministic recipes first;
- locate visible composer;
- focus/insert text so the framework editor registers it;
- verify the inserted text;
- submit;
- positively prove a new user turn was committed;
- return `{ committed: true, ...receipt }` only after proof.

If the click may have submitted but commit cannot be proved, use `PROMPT_COMMIT_UNVERIFIED`; do not retry submission blindly.

### `waitForResponse()`

Use `src/browser/response-gate.js` rather than inventing a new completion heuristic.

The driver should feed it browser samples containing:

```text
contentKey
textLength
stopVisible
terminalActionVisible
strongActivityVisible
```

Scope samples to the expected conversation/assistant turn. Observer + polling/watchdog paths are desirable. Return a response only after positive terminal proof.

## Browser error mapping

Prefer existing codes:

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

Only actual recipe drift should be `UI_RECIPE_MISS`.

## After issue #1

In order:

1. live same-conversation smoke test;
2. durable automatic `prompter run` / `resume` flow;
3. `prompter doctor` diagnostics;
4. bounded DOM/AX/screenshot diagnostics;
5. optional mechanic endpoint + verified recipe update path;
6. deterministic verifier/evidence hooks;
7. optional OpenCode executor;
8. optional Codex app-server executor;
9. GUI only after headless zero-touch flow is dependable.

Do not add model pickers, ChatGPT Work, Deep Research, attachment pipelines, generic multi-agent frameworks, or vision computer-use fallback before the simple automatic loop works reliably.

## Before finishing any coding task

```text
1. npm test
2. add tests for new invariants
3. confirm the change moves toward zero-touch automation rather than manual relay
4. update docs/CODEX_HANDOFF.md if the next milestone changed
5. only update docs/UPSTREAM_MINING.md when new upstream research was genuinely required
```

When unsure, implement the smallest testable slice while preserving the boundaries above and the zero-touch automation North Star.
