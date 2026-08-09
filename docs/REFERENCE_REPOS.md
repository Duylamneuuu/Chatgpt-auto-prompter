# Reference repositories to study

These are architectural/code-mining references, not automatic dependencies. Verify the current license before copying source and preserve required notices.

## Tier S — inspect deeply

1. `steipete/oracle` — ChatGPT/browser transport patterns, CDP attachment, session/follow-up lifecycle.
2. `adamallcock/codex-chatgpt-control` — thread identity, structured stop reasons, browser postconditions.
3. `miuuyy/codex-chatgpt-web` — ChatGPT DOM handling, launcher/profile management, smoke tests, UI-drift handling.
4. `browserbase/stagehand` — cached browser actions and self-healing patterns.
5. `browser-use/browser-harness` — learned domain skills / helper recipes.
6. `openai/codex` — supported executor behavior and non-interactive/app-server patterns.

## Tier A — subsystem patterns

7. `microsoft/playwright-cli` — deterministic browser control.
8. `ChromeDevTools/chrome-devtools-mcp` — console/network/runtime diagnostics.
9. `web-infra-dev/midscene` — vision-first browser interaction fallback.
10. `decolua/9router` — OpenAI-compatible local routing for optional mechanic models.
11. `anomalyco/opencode` — provider/session/plugin abstractions and alternate executor integration.

## Tier B — reference/fallback

12. `microsoft/playwright-mcp`
13. `vercel-labs/agent-browser`
14. `browser-use/browser-use`

## Reuse rules

- Prefer concepts and clean-room reimplementation where a dependency would over-couple Prompter.
- Copy source only when its license permits it and preserve required copyright/license notices.
- Keep the Prompter core independent from any one browser automation project.
- Do not import behavior whose primary purpose is bypassing an upstream service's restrictions.
