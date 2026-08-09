// Research snapshot: 2026-08-09.
//
// These are deliberately data, not browser logic. They combine conservative
// selector patterns observed in current Oracle and codex-chatgpt-web sources.
// Runtime UI drift should update the user's .prompter recipe copy rather than
// requiring edits to the autonomous core.
export const CHATGPT_DEFAULT_RECIPES = Object.freeze({
  schemaVersion: 1,
  site: "chatgpt.com",
  sourceSnapshot: "2026-08-09",
  recipes: {
    composer: {
      strategy: "selectors",
      selectors: [
        '[data-testid="prompt-textarea"]',
        "#prompt-textarea",
        'textarea[name="prompt-textarea"]',
        'textarea[aria-label="Message ChatGPT"]',
        'textarea[aria-label="Chat with ChatGPT"]',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"][data-lexical-editor="true"]',
      ],
      mustBeVisible: true,
    },
    send: {
      strategy: "selectors",
      selectors: [
        'button[data-testid="send-button"]',
        'button[data-testid*="composer-send"]',
        'form button[type="submit"]',
        'button[type="submit"][data-testid*="send"]',
        'button[aria-label*="Send"]',
      ],
      mustBeVisible: true,
    },
    stop: {
      strategy: "selectors",
      selectors: [
        'button[data-testid="stop-button"]',
        'button[data-testid="composer-stop-button"]',
        'form button[aria-label*="stop" i]:not([aria-label*="dictat" i]):not([aria-label*="voice" i]):not([aria-label*="read" i])',
      ],
      mustBeVisible: true,
    },
    assistantTurn: {
      strategy: "selectors",
      selectors: [
        '[data-testid^="conversation-turn-"][data-turn="assistant"]',
        '[data-testid^="conversation-turn-"][data-message-author-role="assistant"]',
        '[data-testid^="conversation-turn-"]:has([data-message-author-role="assistant"])',
        '[data-message-author-role="assistant"]',
        '[data-turn="assistant"]',
      ],
      mustBeVisible: true,
    },
    userTurn: {
      strategy: "selectors",
      selectors: [
        '[data-testid^="conversation-turn-"][data-turn="user"]',
        '[data-testid^="conversation-turn-"][data-message-author-role="user"]',
        '[data-testid^="conversation-turn-"]:has([data-message-author-role="user"])',
        '[data-message-author-role="user"]',
        '[data-turn="user"]',
      ],
      mustBeVisible: true,
    },
    completionAction: {
      strategy: "selectors",
      selectors: [
        'button[data-testid="copy-turn-action-button"]',
        'button[data-testid="good-response-turn-action-button"]',
        'button[data-testid="bad-response-turn-action-button"]',
        'button[aria-label="Share"]',
      ],
      mustBeVisible: true,
    },
  },
});
