import { logAudit } from "@/lib/audit";
import { clientIpHash } from "@/lib/ip";
import { getCurrentUser } from "@/lib/session";
import { exportUserData } from "@/server/services/accounts";

/** "Baixar meus dados" (LGPD): JSON com cadastro, endereços, pedidos e consentimentos do cliente logado. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return Response.json(
      { error: "Entre na sua conta para baixar os seus dados." },
      { status: 401 },
    );

  const data = await exportUserData(user.id);
  // Toda exportação de dados pessoais fica registrada.
  await logAudit({
    userId: user.id,
    action: "customer.self_export",
    entityType: "User",
    entityId: user.id,
    ipHash: clientIpHash(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
