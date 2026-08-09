# Codex Handoff

This file is the implementation handoff for a coding agent continuing the project.

## Product in one sentence

A local deterministic orchestrator lets a supervisor repeatedly task and review a coding agent until the supervisor accepts the result or the run reaches a safe blocker.

## What exists conceptually

Prompter has three major roles:

1. **Supervisor** — planning/review intelligence. It sees the user's brief and compact evidence from the executor.
2. **Prompter Core** — deterministic orchestration, persistence, retry/block policy, and event logging.
3. **Executor** — Codex first; later OpenCode or other coding agents.

Optional fourth role:

4. **UI Healer** — only repairs browser interaction drift for supervisor transports that use a UI.

## The immediate target

Build a reliable local V0/V1 before attempting self-healing UI.

### Definition of done for the next milestone

A developer can point Prompter at a disposable local git repository, provide a brief, and run an end-to-end autonomous loop using a test/mock supervisor and a real command executor. The run must:

- persist every major phase;
- terminate safely at `done`, `blocked`, `failed`, `cancelled`, or max cycles;
- survive malformed supervisor output without corrupting state;
- capture compact executor reports;
- expose deterministic logs/events;
- have tests covering state transitions;
- never require an LLM to repair internal core state.

Then add a real Codex non-interactive adapter.

## Do not start here

Do **not** begin by building:

- a dashboard;
- a generic LangChain/LangGraph multi-agent system;
- an AI that edits Prompter when Prompter crashes;
- CAPTCHA/login bypasses;
- a large plugin marketplace;
- complex vision fallback.

Those are later concerns.

## Recommended work queue

### 1. Harden schemas

Validate all input/output at adapter boundaries. It is fine to introduce a small schema library if it materially improves reliability, but avoid dependency sprawl.

Required data types:

- `RunCheckpoint`
- `SupervisorInput`
- `SupervisorDecision`
- `ExecutorTask`
- `ExecutorResult`
- `PrompterEvent`
- `BlockReason`

### 2. State machine

Refactor the initial loop into explicit states/transitions. Persist transition metadata and the previous safe checkpoint.

Need tests for:

- plan -> execute -> review -> done;
- multiple next-task cycles;
- max-cycle block;
- supervisor throws;
- executor throws;
- malformed decision;
- cancellation;
- checkpoint write failure;
- UI healer not invoked for backend/core failure.

### 3. Codex adapter

Use supported non-interactive Codex functionality. Do not automate the interactive terminal UI.

Capture enough structured data to produce an `ExecutorResult` containing at least:

```json
{
  "status": "completed",
  "summary": "...",
  "filesChanged": [],
  "checks": [],
  "unresolved": [],
  "exitCode": 0
}
```

Raw logs may be persisted locally but should not automatically be sent to the supervisor.

### 4. Verifier hooks

Add optional deterministic evidence providers:

- git diff/stat;
- configured test command;
- configured build command;
- screenshot/artifact path.

A verifier gathers evidence; it does not decide the product is good. The supervisor makes the product-quality decision.

### 5. Browser supervisor adapter

Only after the core + executor are robust. Keep browser mechanics behind one module/package. Any browser-side failure should map to structured codes such as:

```text
UI_RECIPE_MISS
AUTH_REQUIRED
CAPTCHA
THREAD_MISMATCH
RESPONSE_TIMEOUT
UNKNOWN_PAGE_STATE
```

The core uses these codes; it must not inspect DOM selectors.

### 6. UI healer

The mechanic can receive only narrow diagnostics and narrow tools. Example allowed capabilities:

```text
get_current_url
get_accessibility_snapshot
get_dom_excerpt
get_screenshot
probe_element
save_candidate_recipe
run_recipe_smoke_test
```

Disallow arbitrary filesystem and shell access by default for this component.

## Research priorities

Read these first when their subsystem becomes relevant:

- `steipete/oracle`
- `adamallcock/codex-chatgpt-control`
- `miuuyy/codex-chatgpt-web`
- `browserbase/stagehand`
- `browser-use/browser-harness`
- `openai/codex`

Then consult Tier A/B references in `REFERENCE_REPOS.md`.

## UX target later

The eventual user flow should be approximately:

```text
prompter start C:\Projects\my-app

Supervisor: connected
Executor: Codex
Max cycles: 8
Run: started

[1] planning
[1] executing task-1
[1] reviewing
[2] executing task-2
...
DONE
```

The user should be able to pause/stop and inspect evidence, but normal runs should not require manual copy/paste.

## Security / service boundary

Read `SERVICE_BOUNDARIES.md` before adding any browser automation. The project should remain useful even if a specific web supervisor transport is disabled or unavailable.
