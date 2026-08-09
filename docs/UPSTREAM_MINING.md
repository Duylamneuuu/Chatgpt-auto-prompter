# Upstream Mining Digest

Research snapshot: **2026-08-09**

This file exists so coding agents working on this repository do **not** need to scan six large upstream repositories before making progress. The goal is to preserve the useful implementation patterns, concrete source locations, and architectural lessons while keeping ChatGPT Auto Prompter independent.

Do not vendor or copy large upstream modules blindly. Re-implement the small patterns we need behind our own interfaces. If code is copied rather than reimplemented, verify the upstream license and preserve required notices.

---

## Executive conclusion

The shortest credible path is:

```text
Prompter deterministic core
        |
        +--> CodexExecutor
        |       V0/V1: codex exec
        |       V2: codex app-server
        |
        +--> ChatGptSupervisorAdapter
                deterministic browser recipe first
                |
                +--> selector/AX/CDP recipe cache
                |
                +--> bounded UI healer only on recipe drift
```

The upstream projects collectively show that the hard problems are not "how to click a button". The hard problems are:

1. proving that a prompt was actually committed;
2. proving that the assistant response is actually complete;
3. preserving thread identity after timeout/restart;
4. failing closed on login/challenge/permission/UI ambiguity;
5. keeping UI selectors out of the autonomous core;
6. replaying known UI actions without paying for an LLM every run;
7. updating only the UI recipe when the site drifts.

Those are the patterns to implement.

---

# 1. `steipete/oracle`

Role in our research: **best source for battle-tested ChatGPT browser lifecycle and response-completion logic**.

Do not adopt Oracle as Prompter's architecture. Mine its browser patterns.

## Files worth knowing

### `src/browser/actions/promptComposer.ts`

Most useful lessons:

- Maintain **multiple composer selectors**, choose a visible candidate rather than assuming one selector forever.
- Focus the actual editor before inserting text. React/ProseMirror/Lexical style editors can ignore naive DOM writes.
- After insertion, **read the composer back** and verify the text landed.
- Have a fallback that dispatches real input/change events if normal insertion failed.
- Detect silent large-prompt truncation before sending.
- Try the visible send control, with a keyboard fallback only where safe.
- Most importantly, **verify the user turn appeared after submitting**. A successful click is not proof of submission.

Prompter adaptation:

```text
prepare composer
-> insert text
-> verify composer contains expected prompt fingerprint
-> submit
-> verify a new user turn exists
-> only then mark SUPERVISOR_PROMPT_COMMITTED
```

Never advance the state machine merely because `click()` returned successfully.

### `src/browser/actions/assistantResponse.ts`

This is one of the most important upstream files for us.

Oracle learned that a response can look stable while ChatGPT is still thinking or between phases. It therefore avoids the naive rule:

```text
"text stopped changing for N seconds" == complete
```

Useful patterns:

- Two independent capture paths: DOM observer plus polling/watchdog fallback.
- Scope capture to the expected assistant turn/conversation.
- Track a content fingerprint, not only text length. Same-length rewrites must reset stability.
- Strong "still working" signals veto completion.
- Require positive evidence of a terminal state.
- Refuse to finalize an unconfirmed response near timeout.
- Capture diagnostics when completion cannot be proven.

Prompter adaptation:

```text
WAITING_RESPONSE
  |
  +-- observe target assistant turn
  +-- poll target assistant turn
  +-- verify no strong working signal
  +-- verify terminal action/control or equivalent positive postcondition
  +-- verify content stable across confirmation samples
  |
  +--> RESPONSE_COMPLETE

otherwise -> structured timeout/blocker, never return partial text as final
```

### `src/browser/index.ts`

Useful architectural patterns:

- Browser lifecycle and page actions are separated.
- Attach-running browser vs launched browser are separate modes.
- Browser/tab ownership is explicit.
- UI warnings such as rate-limit/auth/challenge are classified separately.
- Failed/stalled runs can preserve enough browser state for diagnostics.
- Diagnostic capture is bounded and redacts likely secrets.

Prompter should similarly distinguish:

```text
browser transport failure
page/session failure
UI recipe drift
auth/challenge
service warning
assistant timeout
```

Do not collapse all of these into `UI_RECIPE_MISS`.

### `src/browser/actions/*`, `src/browser/reattach.ts`, `src/browser/domDebug.ts`

Inspect later only if a specific implementation gap remains. Do not make Codex read the whole Oracle tree up front.

## What NOT to copy

- Oracle's full prompt bundling system.
- Oracle's API/browser engine selection.
- Deep Research handling.
- its complete CLI/session product.

Prompter needs a narrower supervisor transport.

---

# 2. `adamallcock/codex-chatgpt-control`

Role in our research: **best source for semantic ChatGPT control contracts and stop/blocker behavior**.

## Core architectural lesson

The project treats visible ChatGPT as a semantic surface rather than a bag of selectors:

```text
agent
-> SDK runner
-> semantic Chat/Work controls
-> browser bridge
-> visible chatgpt.com
```

For Prompter, use the same separation:

```text
Prompter core
-> Supervisor interface
-> ChatGptSupervisorAdapter
-> ChatGptUiDriver
-> browser transport
```

The core should know nothing about `data-testid`, buttons, tabs, model pickers, etc.

## Important patterns

### Strict postcondition verification

Configuration or navigation mutation should be followed by a read-back. Example concept:

```text
request: open Chat
mutation: click Chat control
postcondition: semantic detector reports experience == chat
```

Do this for:

- thread opened;
- expected conversation reused;
- prompt submitted;
- response completed;
- model/effort selection if Prompter ever exposes that;
- file upload complete.

### Start/status/wait/read separation

The project intentionally separates long-running operations so a timeout does **not** cause duplicate submission.

Adopt this heavily.

Bad:

```text
submitAndWait()
-> timeout
-> retry submitAndWait()
-> duplicate prompt
```

Good:

```text
submit() -> submission identity
wait(identity)
-> timeout
status(identity)
-> still running -> continue wait
-> complete -> read(identity)
```

Our browser adapter should eventually expose something close to:

```ts
prepareThread()
submitPrompt()
getPromptStatus()
waitForResponse()
readResponse()
```

### Structured blockers

Known hard blockers should be machine-readable, not random thrown strings.

Examples we should support:

```text
BROWSER_UNAVAILABLE
AUTH_REQUIRED
HUMAN_VERIFICATION_REQUIRED
PERMISSION_REQUIRED
RATE_LIMITED
SERVICE_UNAVAILABLE
UI_RECIPE_MISS
THREAD_IDENTITY_UNVERIFIED
RESPONSE_TIMEOUT
```

UI healing may act on `UI_RECIPE_MISS` only.

### Preserve thread/task identity

When continuing an existing conversation, verify it before sending the next prompt. A stale tab or wrong conversation must fail closed.

For Prompter this means checkpointing at least:

```json
{
  "supervisor": {
    "conversationUrl": "...",
    "conversationId": "...",
    "lastCommittedPromptId": "...",
    "lastCapturedTurnId": "..."
  }
}
```

Fields can be null when the adapter cannot observe them, but the state model should have room for them.

## What NOT to copy

- ChatGPT Work support is not required for V1.
- Python parity client is not required.
- plugin packaging is not required yet.

Our product is much narrower: autonomous review/execute loop.

---

# 3. `miuuyy/codex-chatgpt-web`

Role in our research: **best compact source for current ChatGPT selector strategy, capability probing, diagnostics/doctor ideas, and cross-platform launcher lessons**.

Do not adopt its Responses-provider interception architecture. That is the part most likely to conflict with OpenCodex and is not what Prompter is trying to be.

## Files worth knowing

### `src/chatgpt-session.ts`

Current source contains useful selector strategy:

- composer: several fallback selectors rather than one;
- stop control;
- assistant/user turn selectors;
- completion/copy action control;
- effort/model UI selectors.

More important than the exact selectors are the patterns:

1. `anyVisible(locator)` checks all matches and accepts a visible one.
2. Account capability detection waits for a **stable presence or stable absence**, rather than making a conclusion from one sample.
3. Authentication is checked through a visible composer postcondition.
4. Temporary-chat mode verifies the final URL rather than assuming navigation succeeded.
5. Model/capability UI is inspected semantically enough to tolerate multiple layouts.

Prompter should put exact selector values in a data-oriented recipe file, not scatter them through code:

```text
src/supervisors/chatgpt/recipes/default.json
```

Possible schema:

```json
{
  "version": 1,
  "composer": {
    "selectors": ["..."],
    "mustBeVisible": true
  },
  "send": {
    "selectors": ["..."]
  },
  "assistantTurn": {
    "selectors": ["..."]
  }
}
```

### `src/doctor.ts`

Mine the **doctor philosophy**, not its exact checks:

Prompter should eventually have:

```text
prompter doctor
```

checking independently:

- Node version;
- project directory;
- Codex executable;
- Codex non-interactive smoke;
- browser CDP availability;
- ChatGPT signed-in state;
- composer discoverability;
- prompt submit smoke in an explicitly requested test thread;
- checkpoint directory writable;
- optional UI-healer endpoint health.

The doctor should identify the failing layer instead of saying "bridge failed".

### diagnostics

The project captures bounded JSON state at checkpoints and screenshots on stalled/failed browser turns. Adopt this.

Do **not** screenshot every successful action by default. That wastes storage and creates more sensitive artifacts.

## What NOT to copy

- Responses API impersonation/translation layer.
- native Codex model injection.
- MCP tunnel/full-harness machinery.
- compiled-context forwarding.

Those solve a different problem.

---

# 4. `browserbase/stagehand`

Role in our research: **best concrete implementation pattern for deterministic replay that self-heals and then refreshes its cache**.

## Important file

### `packages/core/lib/v3/cache/AgentCache.ts`

This file validates the architecture we wanted for Prompter's UI healer.

Relevant lifecycle:

```text
first successful intelligent run
-> record replay steps
-> store cache entry

later run
-> load cache
-> replay deterministic actions
-> action implementation may return updated action/selector
-> compare old vs updated actions
-> if changed, rewrite cache entry
```

The cache key includes instruction, start URL, options/config signature and variable shape. Sensitive model config values such as API keys are sanitized before persistence.

Most important concrete pattern from replay:

```text
wait for cached selector
-> take deterministic action
-> if action resolves to a changed selector/action
-> use updated action
-> refresh cache after successful replay
```

This maps almost exactly to Prompter:

```text
load ChatGPT recipe
-> deterministic action
-> if recipe miss
-> collect bounded diagnostics
-> mechanic proposes replacement action
-> verify replacement postcondition
-> update recipe atomically
-> retry once
```

## Our implementation should be SMALLER

We do not need a generic agent cache.

Use a site-specific recipe store:

```text
.prompter/ui-recipes/chatgpt.json
```

A recipe update should require:

1. old deterministic action failed with `UI_RECIPE_MISS`;
2. mechanic output passes schema validation;
3. replacement action succeeds in the current page;
4. postcondition succeeds;
5. recipe is atomically persisted;
6. original supervisor operation is retried at most once.

Never persist an unverified AI suggestion.

---

# 5. `browser-use/browser-harness`

Role in our research: **best source for thin CDP control, accessibility-first discovery, and learned per-domain skills**.

## `SKILL.md` lessons

Their normal browser workflow prefers:

```text
Accessibility.getFullAXTree
-> locate element by semantic role/name
-> DOM.getBoxModel using backendDOMNodeId
-> click center coordinates
-> verify targeted postcondition
```

Then:

- fall back to raw DOM inspection when the AX tree is insufficient;
- use screenshots when layout/visual meaning matters;
- keep raw CDP available for diagnostics;
- treat login walls as blockers.

Prompter can use a simpler variant:

```text
Tier 0: known deterministic selectors
Tier 1: accessibility-role/name recipe
Tier 2: bounded healer inspects AX + DOM
Tier 3: optional vision fallback later
```

### Domain skills pattern

Browser Harness keeps site-specific learned behavior under a separate editable workspace rather than allowing an agent to rewrite protected core code.

Adopt that security boundary:

```text
src/                       protected application code
.prompter/ui-recipes/      runtime learned UI data
```

or for bundled defaults:

```text
src/supervisors/chatgpt/default-recipes/
```

A mechanic model gets write access only to a recipe update interface, not arbitrary filesystem write.

## What NOT to copy

- "agent writes any helper it needs" is too broad for our runtime.
- cloud browser/captcha-solving features are outside Prompter's scope.
- Prompter should not become a generic browser agent.

---

# 6. `openai/codex`

Role in our research: **official executor integration source**.

## V1 recommendation: keep `codex exec`

For the first usable product, keep the executor easy to debug and easy to spawn. Do not switch to app-server until the supervisor loop works end-to-end.

Requirements for our `CodexExecExecutor`:

- non-interactive execution only;
- bounded timeout/cancellation;
- capture stdout/stderr separately;
- parse structured JSONL when enabled rather than treating it as one giant report;
- preserve the final agent message plus important execution facts;
- distinguish spawn/process failure from a task that completed with an unsuccessful report;
- bound raw log size sent back to the supervisor.

## V2 recommendation: add `CodexAppServerExecutor`

The official app-server exposes a much better long-running integration model:

```text
initialize
-> initialized
-> thread/start OR thread/resume
-> turn/start
-> stream item/turn notifications
-> turn/completed
```

Useful official properties:

- JSON-RPC style protocol over JSONL stdio;
- explicit `Thread`, `Turn`, `Item` primitives;
- `thread/resume` for durable conversations;
- `thread/fork` when branching is useful;
- `turn/interrupt` for cancellation;
- generated TypeScript/JSON schemas matching the installed Codex version;
- explicit overloaded-server error suitable for bounded backoff.

Prompter architecture should leave room for this without requiring it in V1.

Suggested future interface:

```ts
class CodexAppServerExecutor {
  initialize()
  startThread(options)
  resumeThread(threadId)
  executeTurn(threadId, task, options)
  interruptTurn(threadId, turnId)
}
```

The executor checkpoint can then preserve:

```json
{
  "executor": {
    "kind": "codex-app-server",
    "threadId": "...",
    "turnId": "..."
  }
}
```

## Fresh session vs resume

Prompter should eventually support both:

```text
fresh-per-cycle
resume-thread
```

Default recommendation remains **fresh-per-cycle for early versions** because the repository itself carries most implementation state and fresh contexts prevent runaway context growth. Resume can later be used when a task genuinely benefits from Codex retaining reasoning/session state.

---

# Cross-project patterns to implement

## A. Error taxonomy

Create machine-readable error codes. Suggested initial set:

```text
CORE_INVARIANT_FAILED
INVALID_SUPERVISOR_DECISION
INVALID_EXECUTOR_RESULT
EXECUTOR_SPAWN_FAILED
EXECUTOR_TIMEOUT
EXECUTOR_PROCESS_FAILED
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

Only these are UI-healable:

```text
UI_RECIPE_MISS
```

Possibly in a later version, a more specific subset such as:

```text
COMPOSER_RECIPE_MISS
SEND_RECIPE_MISS
ASSISTANT_TURN_RECIPE_MISS
```

All auth/challenge/rate-limit/core errors remain outside the healer.

## B. Browser action contract

Every semantic action should have:

```ts
{
  action,
  preconditions,
  mutation,
  postconditions,
  diagnosticsOnFailure
}
```

Examples:

```text
OPEN_THREAD
pre: browser connected
mutate: navigate/open tab
post: conversation identity matches expected
```

```text
SUBMIT_PROMPT
pre: composer available + expected thread
mutate: fill and submit
post: new user turn with expected fingerprint exists
```

```text
READ_RESPONSE
pre: expected submitted turn exists
mutate: none
post: corresponding assistant turn has positive terminal proof
```

## C. No duplicate submissions

A timeout is not permission to submit again.

Checkpoint submission state:

```text
NOT_STARTED
PREPARED
COMMITTED
WAITING_RESPONSE
RESPONSE_CAPTURED
```

On restart:

- `NOT_STARTED/PREPARED`: safe to reconstruct and submit;
- `COMMITTED/WAITING_RESPONSE`: recover the existing turn, **do not submit again**;
- `RESPONSE_CAPTURED`: continue supervisor decision parsing.

## D. UI recipe storage

Suggested schema:

```json
{
  "schemaVersion": 1,
  "site": "chatgpt.com",
  "updatedAt": "...",
  "recipes": {
    "composer": {
      "strategy": "selectors",
      "selectors": [],
      "postcondition": "visible-editable"
    },
    "send": {
      "strategy": "selectors",
      "selectors": []
    },
    "assistantTurn": {
      "strategy": "selectors",
      "selectors": []
    }
  }
}
```

Runtime recipe changes should be written atomically and keep one previous known-good copy for rollback.

## E. Mechanic model boundary

The mechanic gets **observations**, not unrestricted computer access.

Allowed inputs:

- bounded DOM snippets;
- AX nodes around relevant semantic names;
- current URL/path;
- screenshot when enabled;
- old recipe;
- exact failed postcondition.

Allowed output:

```json
{
  "candidate": {
    "strategy": "selector|ax",
    "selector": "...",
    "role": "...",
    "name": "..."
  },
  "confidence": 0.0,
  "reason": "..."
}
```

The model does **not** write the recipe file itself. Prompter validates and applies the candidate through bounded code.

## F. Diagnostics bundle

On browser failure, generate a bounded local bundle such as:

```text
.prompter/runs/<run-id>/diagnostics/<timestamp>/
  state.json
  error.json
  dom-summary.json
  ax-summary.json
  screenshot.png       # only when enabled/needed
```

Redact:

- cookies;
- authorization headers;
- session tokens;
- API keys;
- email where practical;
- prompt/response body from generic logs unless the user enabled verbose content logging.

---

# Concrete implementation order for this repository

Coding agents should follow this order unless a failing test proves another dependency must be addressed first.

## Milestone 1 — harden deterministic core

Implement:

```text
src/core/errors.js
src/core/protocol.js
src/core/prompter.js
```

Add strict validation to **all** Supervisor implementations, not only `CommandSupervisor`.

Add executor result validation.

Persist failures and blockers with reason/code.

Make UI healing a one-retry transition so a broken healer cannot loop forever.

Tests:

```text
invalid direct-supervisor output
invalid executor result
UI recipe miss -> healer -> one retry
UI healer failure
non-UI error never invokes healer
maxCycles
```

## Milestone 2 — improve Codex exec adapter

Implement a JSONL parser that extracts at minimum:

- final agent text;
- observed command/tool failure indicators where practical;
- exit status;
- bounded raw tail for diagnostics.

Do not forward an unbounded Codex transcript to the supervisor.

Add process timeout and cancellation semantics that work on Windows.

## Milestone 3 — build browser contract without ChatGPT implementation

Create interfaces/data types first:

```text
src/browser/browser-driver.js
src/browser/browser-errors.js
src/browser/recipe-store.js
src/browser/diagnostics.js
src/supervisors/chatgpt/chatgpt-supervisor.js
```

Use a fake browser driver for tests.

Prove:

```text
prepare -> submit -> commit verified -> wait -> completion verified -> parse decision
```

before touching live ChatGPT.

## Milestone 4 — minimal live ChatGPT adapter

Start with only:

1. attach to a user-owned Chrome instance through CDP;
2. use the currently selected ChatGPT conversation or an explicitly supplied URL;
3. locate composer;
4. submit one prompt;
5. verify commit;
6. wait for positively confirmed completion;
7. return Markdown/text;
8. same-thread follow-up.

Do not implement model selection, uploads, Work, Deep Research, or a custom browser launcher yet.

## Milestone 5 — UI recipe recovery

Only after deterministic live operation passes repeatedly:

```text
recipe miss
-> diagnostics
-> bounded healer candidate
-> verify candidate
-> atomically update recipe
-> retry original semantic action once
```

Use an OpenAI-compatible mechanic provider interface so 9Router or another local router can be configured, but keep it optional.

## Milestone 6 — doctor + crash recovery

Add:

```text
prompter doctor
prompter run
prompter resume
```

Resume must never duplicate an already-committed browser prompt.

## Milestone 7 — Codex app-server executor

Only after the full product works through `codex exec`.

---

# Upstream re-reading policy for coding agents

**Do not scan all six upstream repositories.** This digest is the default source of truth for implementation direction.

Read upstream source only when one of these is true:

1. this document names an exact upstream file and the current task needs missing implementation detail;
2. a live UI behavior contradicts the pattern documented here;
3. a dependency/API version changed and its current contract must be verified;
4. a licensing question requires checking exact provenance.

When reading upstream, read the smallest relevant file/range and record any new reusable lesson back into this document.

---

# License note

At the time of this research snapshot, the six repositories above publish permissive open-source licenses (MIT for Oracle, codex-chatgpt-control, codex-chatgpt-web, Stagehand, Browser Harness; Apache-2.0 for OpenAI Codex). Verify the exact current license before copying substantive code. Prefer reimplementation of patterns and small interfaces rather than wholesale source copying.
