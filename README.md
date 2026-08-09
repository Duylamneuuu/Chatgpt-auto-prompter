# ChatGPT Auto Prompter

> Brainstorm with a supervisor. Let it drive a coding agent through repeated execute → review → improve cycles until the result is accepted.

ChatGPT Auto Prompter is an experimental autonomous supervisor loop. A supervisor produces compact coding tasks, a local coding agent executes them, and the supervisor reviews the handoff report and either accepts the result or issues the next task.

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
      +---- report ----> supervisor
```

## Goal

Remove the human copy/paste relay from the common workflow:

1. brainstorm and plan;
2. turn the plan into a coding task;
3. execute with Codex or another coding agent;
4. inspect tests, diffs, screenshots, and the executor report;
5. issue a follow-up task when necessary;
6. repeat until accepted or safely blocked.

The relay itself should not require another expensive reasoning model.

## Design principles

- **Deterministic core.** No LLM decides state transitions or silently repairs backend invariants.
- **Replaceable supervisor.** The supervisor transport is an adapter, not part of the core.
- **Replaceable executor.** Codex is first, but OpenCode and other coding agents can be added later.
- **Context firewall.** Supervisor sends compact tasks; executor returns compact handoff reports.
- **Fail closed.** Authentication, CAPTCHA, unknown UI states, corrupted checkpoints, and core bugs stop rather than blind-clicking.
- **Bounded UI healing.** Optional AI may rediscover moved/renamed browser controls and update UI recipes. It must not rewrite Prompter core/backend code.
- **Crash resumability.** Persist enough state to continue or diagnose an interrupted autonomous run.

## Current status

**V0 scaffold.** The deterministic autonomous loop is the first milestone; a production supervisor transport is intentionally not coupled to the core.

Implemented/scaffolded:

- multi-cycle supervisor/executor state machine;
- `NEXT_TASK → execute → review` loop;
- checkpoint persistence;
- max-cycle fail-closed behavior;
- Codex `exec` executor scaffold;
- generic command-based supervisor adapter;
- bounded UI-healer interface;
- zero runtime dependencies;
- unit tests.

## Development

```bash
npm test
npm run demo
```

Node.js 20+ is expected. V0 has no third-party runtime dependency.

## Protocol

A supervisor returns exactly one decision:

```json
{ "kind": "next_task", "task": { "id": "task-3", "prompt": "Fix ..." } }
```

```json
{ "kind": "done", "summary": "Accepted." }
```

```json
{ "kind": "blocked", "reason": "Login required." }
```

This keeps browser/UI churn outside the autonomous core.

## For coding agents

Read [`AGENTS.md`](AGENTS.md) first. It defines the product goal, invariants, architecture boundaries, implementation order, and what **not** to change. The detailed handoff is in [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md).

## Policy / service boundaries

This project is an orchestration framework, not a rate-limit or access-control bypass. Integrations must respect the terms of every upstream service. Do not add CAPTCHA bypasses, credential harvesting, hidden-endpoint reverse engineering, account sharing, rate-limit evasion, or behavior intended to circumvent usage limits. Prefer officially supported APIs/integrations where required by the upstream service's terms.

See [`docs/SERVICE_BOUNDARIES.md`](docs/SERVICE_BOUNDARIES.md).

## Docs

- [`AGENTS.md`](AGENTS.md) — instructions for Codex and other coding agents
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/UI_HEALING.md`](docs/UI_HEALING.md)
- [`docs/REFERENCE_REPOS.md`](docs/REFERENCE_REPOS.md)
- [`docs/SERVICE_BOUNDARIES.md`](docs/SERVICE_BOUNDARIES.md)

## License

MIT.
