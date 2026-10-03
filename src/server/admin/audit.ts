import "server-only";
import { db } from "@/lib/db";

/** Nome de quem fez cada ação (AuditLog guarda só o id, para sobreviver à exclusão do usuário). */
export async function userNames(
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name]));
}

/** Nomes legíveis das ações registradas na auditoria. */
const ACTION_LABELS: Record<string, string> = {
  "product.create": "Produto criado",
  "product.update": "Produto alterado",
  "product.update_images": "Imagens do produto alteradas",
  "product.quick_edit": "Edição rápida de preço ou estoque",
  "product.duplicate": "Produto duplicado",
  "product.import": "Importação de produtos",
  "samples.remove": "Dados de teste removidos",
  "order.status_change": "Status do pedido alterado",
  "order.create_manual": "Pedido manual criado",
  "order.note": "Nota interna no pedido",
  "order.reveal_cpf": "CPF do pedido exibido",
  "order.resend_email": "E-mail do pedido reenviado",
  "inventory.adjust": "Ajuste de estoque",
  "inventory.batch_in": "Entrada de estoque em lote",
  "inventory.count": "Contagem de inventário aplicada",
  "media.upload": "Imagem enviada",
  "media.update_alt": "Texto alternativo alterado",
  "media.delete": "Imagem excluída",
  "settings.update": "Configurações alteradas",
  "customer.anonymize": "Cliente anonimizado",
  "customer.self_export": "Cliente baixou os próprios dados",
  "user.invite": "Usuário convidado",
  "user.update": "Usuário da equipe alterado",
};

export function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.endsWith(".export")) return `Exportação (${action.replace(".export", "")})`;
  return action;
}
