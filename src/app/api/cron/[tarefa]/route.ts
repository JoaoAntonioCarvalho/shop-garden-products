import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getJob, runJob } from "@/server/jobs";

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Tarefas agendadas, chamadas por um agendador externo (Vercel Cron, cron do servidor...):
 *   GET /api/cron/expirar-pagamentos   com o cabeçalho   Authorization: Bearer <CRON_SECRET>
 * Sem CRON_SECRET configurado, a rota fica desligada.
 */
export async function GET(request: Request, context: RouteContext<"/api/cron/[tarefa]">) {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!sameSecret(given, secret))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const job = getJob((await context.params).tarefa);
  if (!job) return NextResponse.json({ error: "Tarefa desconhecida." }, { status: 404 });
  const result = await runJob(job);
  return NextResponse.json({ tarefa: job.key, ...result }, { status: result.ok ? 200 : 500 });
}
