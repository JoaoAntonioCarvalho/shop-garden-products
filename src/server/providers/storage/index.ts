import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider } from "./types";

let instance: StorageProvider | undefined;

/** Provider de armazenamento ativo, escolhido por STORAGE_DRIVER (local | s3). */
export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "s3") {
    instance = new S3StorageProvider();
  } else {
    instance = new LocalStorageProvider();
  }
  return instance;
}

export type { StorageProvider } from "./types";
