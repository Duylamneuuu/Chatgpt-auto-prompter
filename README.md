# ChatGPT Auto Prompter

> Brainstorm once. Let the supervisor keep driving your coding agent until the result is accepted.

ChatGPT Auto Prompter is an experimental autonomous supervisor loop designed to remove the human copy/paste relay between a planning/review surface and a local coding agent.

```text
Supervisor
planner / reviewer
      |
      v
  PROMPTER
 deterministic core
      |
      v
Codex / OpenCode
    executor
      |
      +---- compact report ----> supervisor
```

## Goal

Turn this manual workflow:

```text
ChatGPT -> copy prompt -> Codex -> copy report -> ChatGPT -> copy next prompt -> ...
```

into:

```text
ChatGPT -> Prompter -> Codex -> Prompter -> ChatGPT -> ... -> DONE
```

Normal operation should require no human relay after a run starts. Hard blockers such as authentication or human-verification challenges should stop safely rather than being bypassed.

## Design principles

- **Deterministic core.** No LLM decides whether internal state is valid.
- **Replaceable supervisor.** ChatGPT is a supervisor adapter, not the state machine.
- **Replaceable executor.** Codex is first; other coding agents can follow.
- **Context firewall.** Compact tasks go in; compact handoff reports come back.
- **No duplicate submission.** Timeout/retry after a committed browser prompt resumes the same operation instead of sending it twice.
- **Fail closed.** Unknown state, auth/challenge, unverified prompt commit, incomplete response, or corrupted state stops safely.
- **Bounded UI healing.** Optional AI may rediscover moved browser controls, but only deterministic verification may persist the new data-only recipe.
- **Protected core.** UI repair never means letting a mechanic model rewrite Prompter backend/source code.

## Current status

The headless foundation is substantially beyond the original V0 scaffold.

Implemented:

- multi-cycle `plan -> execute -> review -> next_task/done/blocked` core;
- strict supervisor/executor protocols and structured error codes;
- atomic checkpoints;
- bounded one-shot UI recovery path;
- `codex exec --json` streaming summary collector;
- compact extraction of final Codex agent message, changed files, usage and failure evidence;
- real child-process executor timeout behavior;
- semantic `ChatGptSupervisor` contract independent of DOM/CDP;
- durable supervisor operation state to prevent duplicate committed prompts;
- data-only UI recipe store that rejects unverified AI candidates;
- current default ChatGPT UI recipes kept outside core code;
- positive-proof response terminal classifier;
- upstream implementation mining for Oracle, codex-chatgpt-control, codex-chatgpt-web, Stagehand, Browser Harness, and OpenAI Codex.

Latest reconstructed snapshot: **32 passing Node tests**.

The next major milestone is the minimal live ChatGPT CDP driver. See [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md) and GitHub issue #1.

## Development

```bash
npm test
npm run demo
```

Node.js 20+ is expected. The current foundation intentionally keeps runtime dependencies minimal.

## Supervisor protocol

A supervisor returns exactly one decision:

```json
{ "kind": "next_task", "task": { "id": "task-3", "prompt": "Fix ...", "acceptanceCriteria": ["..."] } }
```

```json
{ "kind": "done", "summary": "Accepted." }
```

```json
{ "kind": "blocked", "reason": "Login required.", "code": "AUTH_REQUIRED" }
```

## For coding agents

Read in this order:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md)
3. [`docs/UPSTREAM_MINING.md`](docs/UPSTREAM_MINING.md)

**Do not scan all upstream repositories first.** `UPSTREAM_MINING.md` already extracts the useful source files, patterns, pitfalls, and implementation order so coding context can be spent on this project instead.

## Service boundaries

This is an orchestration framework, not a rate-limit or access-control bypass. Do not add CAPTCHA bypasses, credential harvesting, hidden-endpoint abuse, account-sharing automation, rate-limit evasion, or other safeguard circumvention.

See [`docs/SERVICE_BOUNDARIES.md`](docs/SERVICE_BOUNDARIES.md).

## Docs

- [`AGENTS.md`](AGENTS.md) — source-of-truth instructions for coding agents
- [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md) — concrete current milestone and acceptance criteria
- [`docs/UPSTREAM_MINING.md`](docs/UPSTREAM_MINING.md) — mined upstream implementation knowledge
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/UI_HEALING.md`](docs/UI_HEALING.md)
- [`docs/REFERENCE_REPOS.md`](docs/REFERENCE_REPOS.md)
- [`docs/SERVICE_BOUNDARIES.md`](docs/SERVICE_BOUNDARIES.md)

## License

MIT.
