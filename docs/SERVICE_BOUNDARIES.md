# Service Boundaries

Prompter should remain an orchestration framework, not a mechanism for bypassing upstream service controls.

## Allowed design intent

- automate a user's own local coding workflow;
- use supported CLIs/APIs/integrations;
- attach to user-controlled browser sessions where permitted;
- detect UI drift and repair local selectors/recipes;
- stop and ask for human intervention when authentication or permissions require it;
- route optional mechanic-model calls through user-configured providers.

## Explicit non-goals

Do not implement or advertise:

- CAPTCHA bypassing;
- credential theft or automated credential collection;
- account sharing or session-token extraction for third parties;
- rate-limit or usage-limit evasion;
- hidden/private endpoint reverse engineering for the purpose of avoiding supported access methods;
- automation designed to defeat access controls or safeguards;
- silent destructive actions in user repositories.

## ChatGPT-specific caution

A browser-based ChatGPT supervisor transport can be technically possible while still being subject to OpenAI's current Terms of Use and product rules. Keep this transport modular and experimental. Do not make the rest of Prompter depend on browser automation being permitted or stable.

OpenAI's Terms of Use currently prohibit automatically or programmatically extracting data or Output and prohibit bypassing rate limits or circumventing restrictions or protective measures. Because a loop that programmatically submits prompts to ChatGPT Web and extracts assistant responses may fall within that language, do not describe the browser transport as officially supported or guaranteed compliant. Prefer supported product/API integrations when they can satisfy the use case.

The browser adapter must also never attempt to bypass a login challenge, CAPTCHA, rate limit, product limit, or other restriction. Return a structured blocker instead.

## Architectural consequence

The project must support interchangeable supervisors:

```text
Supervisor interface
├── supported API adapter
├── local command adapter
├── experimental user-controlled browser adapter
└── future integrations
```

This lets the autonomous orchestration core remain useful independently of any one provider's UI or terms.

## Repository safety

Before an autonomous run modifies a target project, later versions should support:

- clean git status checks;
- optional worktree/branch isolation;
- configurable command allow/deny policy;
- explicit project root confinement;
- maximum cycles/time budget;
- pause/cancel;
- audit logs and checkpoints.
