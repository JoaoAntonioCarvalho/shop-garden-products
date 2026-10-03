import { clientIpHash } from "@/lib/ip";
import { normalizeCep } from "@/lib/validators/cep";
import { rateLimit } from "@/server/services/rate-limit";

type CepAddress = { cep: string; street: string; district: string; city: string; state: string };

// Cache em memória: CEPs mudam muito raramente.
const cache = new Map<string, { address: CepAddress | null; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 3000;

/**
 * Autopreenchimento de endereço pelo ViaCEP. Não é integração de frete. Se o serviço falhar ou
 * estiver desligado (VIACEP_ENABLED=false), responde "indisponível" e o cliente preenche à mão.
 */
export async function GET(request: Request, context: RouteContext<"/api/cep/[cep]">) {
  const { cep: raw } = await context.params;
  const cep = normalizeCep(raw);
  if (!cep) return Response.json({ status: "invalid" }, { status: 400 });

  if (process.env.VIACEP_ENABLED === "false") return Response.json({ status: "unavailable" });

  const cached = cache.get(cep);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(
      cached.address ? { status: "ok", address: cached.address } : { status: "not_found" },
    );
  }

  const limit = await rateLimit("cep", clientIpHash(request.headers));
  if (!limit.allowed) return Response.json({ status: "unavailable" }, { status: 429 });

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return Response.json({ status: "unavailable" });
    const data = (await response.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    const address = data.erro
      ? null
      : {
          cep,
          street: data.logradouro ?? "",
          district: data.bairro ?? "",
          city: data.localidade ?? "",
          state: data.uf ?? "",
        };
    cache.set(cep, { address, expiresAt: Date.now() + TTL_MS });
    if (cache.size > 5000) cache.delete(cache.keys().next().value!);
    return Response.json(address ? { status: "ok", address } : { status: "not_found" });
  } catch {
    // Tempo esgotado ou sem rede: não bloqueia o checkout.
    return Response.json({ status: "unavailable" });
  }
}
