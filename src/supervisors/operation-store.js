import { CheckpointStore } from "../core/checkpoint-store.js";

export class MemoryOperationStore {
  constructor() {
    this.operations = new Map();
  }

  async get(operationId) {
    return this.operations.get(operationId) ?? null;
  }

  async set(operationId, value) {
    this.operations.set(operationId, structuredClone(value));
  }

  async delete(operationId) {
    this.operations.delete(operationId);
  }
}

/**
 * Durable store for supervisor-side semantic operations.
 *
 * A committed browser submission must survive a UI-heal retry or process
 * restart so the adapter can resume waiting instead of submitting twice.
 */
export class FileOperationStore {
  constructor(filePath) {
    this.store = new CheckpointStore(filePath);
  }

  async get(operationId) {
    const document = await this.#load();
    return document.operations[operationId] ?? null;
  }

  async set(operationId, value) {
    const document = await this.#load();
    document.operations[operationId] = value;
    document.updatedAt = new Date().toISOString();
    await this.store.save(document);
  }

  async delete(operationId) {
    const document = await this.#load();
    delete document.operations[operationId];
    document.updatedAt = new Date().toISOString();
    await this.store.save(document);
  }

  async #load() {
    const current = await this.store.load();
    if (!current) return { version: 1, operations: {} };
    if (current.version !== 1 || !current.operations || typeof current.operations !== "object") {
      throw new Error("Unsupported or corrupted supervisor operation store");
    }
    return current;
  }
}
