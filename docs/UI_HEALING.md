# UI Healing

UI healing exists only to adapt browser interaction recipes when a web UI changes.

## Allowed scope

Examples:

- composer moved or changed element type;
- send/stop button selector changed;
- response container structure changed;
- model picker control moved;
- accessibility labels changed;
- upload control moved.

## Forbidden scope

The UI healer must not:

- patch Prompter core/backend source;
- fix corrupted run state by guessing;
- bypass login, CAPTCHA, rate limits, usage limits, or access controls;
- extract or reuse credentials/session tokens outside the user's browser profile;
- gain arbitrary shell/filesystem access by default.

## Recovery hierarchy

```text
1. deterministic cached recipe
2. collect bounded diagnostics on failure
3. optional semantic/DOM mechanic model
4. verify candidate recipe deterministically
5. persist recipe and retry once
6. optional vision fallback for DOM-hostile UI
7. structured BLOCKED if still unresolved
```

## Recipe idea

```json
{
  "site": "chatgpt.com",
  "action": "submit_message",
  "version": 3,
  "locator": {
    "strategy": "accessibility",
    "role": "button",
    "name": "Send"
  },
  "postcondition": {
    "kind": "assistant_turn_started"
  }
}
```

Prefer semantic/accessibility locators over brittle class names. A candidate update is not accepted merely because a click succeeded; its postcondition must also succeed.

## Mechanic provider

A later implementation may use an OpenAI-compatible local endpoint such as a user-configured router. The provider is optional and should be invoked only after deterministic interaction fails.

The mechanic should receive the minimum diagnostic context required: relevant DOM/accessibility excerpt, current URL/state code, and optionally a screenshot. It should return a candidate recipe, not arbitrary executable code.
