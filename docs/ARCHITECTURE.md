# Architecture

Prompter separates deterministic orchestration from replaceable intelligence and transport adapters.

```text
                  +------------------+
                  |    Supervisor    |
                  | planner/reviewer |
                  +--------+---------+
                           |
                           v
                  +------------------+
                  | SupervisorAdapter|
                  +--------+---------+
                           |
                           v
+------------------------------------------------+
|                 Prompter Core                  |
| deterministic state machine / checkpoints / log|
+--------------------------+---------------------+
                           |
                           v
                  +------------------+
                  | ExecutorAdapter  |
                  +--------+---------+
                           |
                           v
                  +------------------+
                  | Codex / OpenCode |
                  +------------------+
```

Normal run states:

```text
IDLE -> PLANNING -> EXECUTING -> VERIFYING -> REVIEWING
                    ^                         |
                    |                         |
                    +------ NEXT_TASK --------+

REVIEWING -> DONE
any state -> BLOCKED / FAILED / CANCELLED
UI transport drift -> RECOVERING_UI -> retry or BLOCKED
```

## Core responsibilities

The core may:

- validate adapter outputs;
- persist checkpoints;
- track cycles and run IDs;
- enforce time/cycle budgets;
- invoke executor/verifier/supervisor in the right order;
- emit structured events;
- stop safely on invariant violation.

The core must not:

- know browser selectors;
- reason with an LLM about corrupted internal state;
- click UI elements;
- silently self-modify;
- bypass provider restrictions.

## Context firewall

Do not pass entire contexts by default.

```text
large supervisor conversation
          |
          v
     compact task
          |
          v
 large executor work/logs
          |
          v
 compact report + bounded evidence
          |
          v
 supervisor review
```

This reduces token waste, stale context, accidental prompt injection from logs, and coupling between the two agents.

## UI healing boundary

For browser-based supervisor transports only:

```text
known recipe
   |
   +--> success -> continue
   |
   +--> fail -> collect bounded diagnostics
              -> optional mechanic model
              -> candidate recipe
              -> deterministic smoke test
              -> persist + retry once
```

If the failure is core/backend/auth/CAPTCHA/access-control related, UI healing must not run.

## Future isolation

Autonomous target-project modifications should eventually run in an isolated git branch/worktree when practical. The Prompter repository itself should not be the target of its UI-healing mechanism.
