import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import type { StorageProvider } from "./types";

/** Armazenamento de desenvolvimento: grava em ./uploads e serve por /media/[...key]. */
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(root: string = resolve(process.cwd(), "uploads")) {
    this.root = root;
  }

  /** Impede que uma chave escape da pasta de uploads. */
  private pathFor(key: string): string {
    const safe = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = resolve(this.root, safe);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error("Chave de armazenamento inválida");
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<string> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return this.url(key);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  url(key: string): string {
    return `/media/${key.split(sep).join("/")}`;
  }

  /** Caminho no disco, usado só por scripts. */
  diskPath(key: string): string {
    return join(this.root, key);
  }
}
