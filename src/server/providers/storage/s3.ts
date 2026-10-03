import { createHash, createHmac } from "node:crypto";
import type { StorageProvider } from "./types";

/**
 * Armazenamento compatível com S3 (AWS S3, Cloudflare R2, MinIO), usando a API REST com
 * assinatura SigV4. Não depende do SDK da AWS.
 *
 * Variáveis: S3_ENDPOINT (ex.: https://<conta>.r2.cloudflarestorage.com ou http://localhost:9000),
 * S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_URL (URL pública do bucket ou do CDN) e,
 * opcionalmente, S3_REGION (padrão "auto").
 */
export class S3StorageProvider implements StorageProvider {
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly publicUrl: string;
  private readonly region: string;

  constructor() {
    const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_URL, S3_REGION } =
      process.env;
    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_PUBLIC_URL) {
      throw new Error(
        "STORAGE_DRIVER=s3 exige S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY e S3_PUBLIC_URL",
      );
    }
    this.endpoint = S3_ENDPOINT.replace(/\/$/, "");
    this.bucket = S3_BUCKET;
    this.accessKey = S3_ACCESS_KEY;
    this.secretKey = S3_SECRET_KEY;
    this.publicUrl = S3_PUBLIC_URL.replace(/\/$/, "");
    this.region = S3_REGION || "auto";
  }

  private encodeKey(key: string) {
    return key.split("/").map(encodeURIComponent).join("/");
  }

  private async request(method: string, key: string, body?: Buffer, contentType?: string) {
    const url = new URL(`${this.endpoint}/${this.bucket}/${this.encodeKey(key)}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256")
      .update(body ?? "")
      .digest("hex");

    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;

    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name]}\n`)
      .join("");
    const canonicalRequest = [
      method,
      url.pathname,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const hmac = (key: Buffer | string, data: string) =>
      createHmac("sha256", key).update(data).digest();
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.secretKey}`, dateStamp), this.region), "s3"),
      "aws4_request",
    );
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    return fetch(url, {
      method,
      headers: {
        ...headers,
        authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body: body ? new Uint8Array(body) : undefined,
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const response = await this.request("PUT", key, data, contentType);
    if (!response.ok) throw new Error(`Falha ao gravar no armazenamento (${response.status})`);
    return this.url(key);
  }

  async get(key: string): Promise<Buffer | null> {
    const response = await this.request("GET", key);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Falha ao ler do armazenamento (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    const response = await this.request("HEAD", key);
    return response.ok;
  }

  async delete(key: string): Promise<void> {
    const response = await this.request("DELETE", key);
    if (!response.ok && response.status !== 404) {
      throw new Error(`Falha ao excluir do armazenamento (${response.status})`);
    }
  }

  url(key: string): string {
    return `${this.publicUrl}/${this.encodeKey(key)}`;
  }
}
