import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ErrorCode } from "../src/core/errors.js";
import { UiRecipeStore, validateRecipe } from "../src/browser/ui-recipe-store.js";

const defaults = {
  schemaVersion: 1,
  site: "chatgpt.com",
  recipes: {
    composer: {
      strategy: "selectors",
      selectors: ['[data-testid="prompt-textarea"]'],
      mustBeVisible: true,
    },
  },
};

test("uses bundled defaults until a runtime recipe exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompter-recipes-"));
  try {
    const store = new UiRecipeStore(join(dir, "chatgpt.json"), { defaults });
    assert.deepEqual((await store.load()).recipes.composer.selectors, ['[data-testid="prompt-textarea"]']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("will not persist an AI candidate until it is externally verified", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompter-recipes-"));
  try {
    const store = new UiRecipeStore(join(dir, "chatgpt.json"), { defaults });
    await assert.rejects(
      () => store.updateRecipe("composer", { strategy: "ax", role: "textbox", name: "Message" }),
      (error) => error.code === ErrorCode.UI_HEAL_FAILED,
    );
    assert.equal((await store.load()).recipes.composer.strategy, "selectors");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verified recipe updates are persisted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompter-recipes-"));
  try {
    const store = new UiRecipeStore(join(dir, "chatgpt.json"), { defaults });
    await store.updateRecipe(
      "composer",
      { strategy: "ax", role: "textbox", name: "Message ChatGPT" },
      { verified: true },
    );
    assert.deepEqual((await store.load()).recipes.composer, {
      strategy: "ax",
      role: "textbox",
      name: "Message ChatGPT",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recipe format rejects executable or unknown strategies", () => {
  assert.throws(
    () => validateRecipe({ strategy: "javascript", code: "document.body.click()" }),
    (error) => error.code === ErrorCode.UI_HEAL_FAILED,
  );
});
