export interface StorageProvider {
  /** Grava o arquivo e devolve a URL pública. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Lê o arquivo, ou null se não existir. */
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** URL pública de uma chave já gravada. */
  url(key: string): string;
}
