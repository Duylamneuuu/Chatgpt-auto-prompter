import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, basename, join } from "node:path";

/**
 * Small durable JSON checkpoint store.
 *
 * Saves are written to a sibling temporary file and then renamed into place so
 * an interrupted write is far less likely to leave a half-written checkpoint.
 */
export class CheckpointStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async save(checkpoint) {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    const tempPath = join(
      dir,
      `.${basename(this.filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
    );

    try {
      await writeFile(tempPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
      await rename(tempPath, this.filePath);
    } finally {
      // Harmless when rename succeeded; important when write/rename failed.
      await rm(tempPath, { force: true }).catch(() => {});
    }
  }

  async load() {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
}
