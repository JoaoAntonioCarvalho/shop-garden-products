import { LocalStorageProvider } from "./local";
import type { StorageProvider } from "./types";

let instance: StorageProvider | undefined;

/** Provider de armazenamento ativo, escolhido por STORAGE_DRIVER (local | s3). */
export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "s3") {
    // Import tardio: o SDK da AWS só é carregado quando o driver s3 está ativo.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3StorageProvider } = require("./s3") as typeof import("./s3");
    instance = new S3StorageProvider();
  } else {
    instance = new LocalStorageProvider();
  }
  return instance;
}

export type { StorageProvider } from "./types";
