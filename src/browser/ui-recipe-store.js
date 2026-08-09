import { CheckpointStore } from "../core/checkpoint-store.js";
import { ErrorCode, PrompterError } from "../core/errors.js";

/**
 * Data-only UI recipes. Runtime healing is allowed to replace these small
 * declarative records after an external verifier proves the candidate works.
 * Arbitrary JavaScript/source patches are intentionally not a recipe format.
 */
export class UiRecipeStore {
  constructor(filePath, options = {}) {
    this.store = new CheckpointStore(filePath);
    this.previousStore = new CheckpointStore(`${filePath}.previous`);
    this.defaults = options.defaults ?? null;
  }

  async load() {
    const runtime = await this.store.load();
    if (runtime) return validateRecipeDocument(runtime);
    return this.defaults ? validateRecipeDocument(structuredClone(this.defaults)) : null;
  }

  async updateRecipe(name, candidate, options = {}) {
    if (options.verified !== true) {
      throw new PrompterError(
        ErrorCode.UI_HEAL_FAILED,
        "Refusing to persist an unverified UI recipe candidate.",
        { details: { recipe: name } },
      );
    }
    if (typeof name !== "string" || !name.trim()) {
      throw new PrompterError(ErrorCode.UI_HEAL_FAILED, "UI recipe name must be non-empty.");
    }

    const normalizedCandidate = validateRecipe(candidate);
    const current = (await this.load()) ?? {
      schemaVersion: 1,
      site: "unknown",
      recipes: {},
    };

    const next = {
      ...current,
      updatedAt: new Date().toISOString(),
      recipes: {
        ...current.recipes,
        [name]: normalizedCandidate,
      },
    };

    const existingRuntime = await this.store.load();
    if (existingRuntime) await this.previousStore.save(existingRuntime);
    await this.store.save(validateRecipeDocument(next));
    return next.recipes[name];
  }
}

export function validateRecipeDocument(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidRecipe("recipe document must be an object");
  }
  if (value.schemaVersion !== 1) {
    throw invalidRecipe(`unsupported recipe schemaVersion: ${String(value.schemaVersion)}`);
  }
  if (typeof value.site !== "string" || !value.site.trim()) {
    throw invalidRecipe("recipe document.site must be non-empty");
  }
  if (!value.recipes || typeof value.recipes !== "object" || Array.isArray(value.recipes)) {
    throw invalidRecipe("recipe document.recipes must be an object");
  }

  const recipes = {};
  for (const [name, recipe] of Object.entries(value.recipes)) {
    recipes[name] = validateRecipe(recipe);
  }
  return { ...value, recipes };
}

export function validateRecipe(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidRecipe("recipe must be an object");
  }

  if (value.strategy === "selectors") {
    if (
      !Array.isArray(value.selectors) ||
      value.selectors.length === 0 ||
      value.selectors.some((selector) => typeof selector !== "string" || !selector.trim())
    ) {
      throw invalidRecipe("selector recipe requires non-empty string selectors");
    }
    return {
      strategy: "selectors",
      selectors: [...value.selectors],
      mustBeVisible: value.mustBeVisible !== false,
    };
  }

  if (value.strategy === "ax") {
    const role = typeof value.role === "string" && value.role.trim() ? value.role.trim() : null;
    const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : null;
    if (!role && !name) throw invalidRecipe("AX recipe requires role and/or name");
    return { strategy: "ax", role, name };
  }

  throw invalidRecipe(`unsupported recipe strategy: ${String(value.strategy)}`);
}

function invalidRecipe(message) {
  return new PrompterError(ErrorCode.UI_HEAL_FAILED, message);
}
