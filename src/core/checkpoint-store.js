import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class CheckpointStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async save(checkpoint) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(checkpoint, null, 2), "utf8");
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
