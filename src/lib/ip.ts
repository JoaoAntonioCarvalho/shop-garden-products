import { createHash } from "node:crypto";

/** IP do cliente a partir dos cabeçalhos do proxy reverso. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "0.0.0.0"
  );
}

/** O IP nunca é guardado puro: só o hash com sal (AUTH_SECRET). */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? ""}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export function clientIpHash(headers: Headers): string {
  return hashIp(clientIp(headers));
}
