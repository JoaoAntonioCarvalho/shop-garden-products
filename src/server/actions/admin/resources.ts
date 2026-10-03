"use server";

import { z } from "zod";
import type { FormValues } from "@/components/admin/entity-form";
import { diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { AdminError, runAdmin, type AdminResult } from "@/server/admin/action";
import { delegateOf, savedMessage, type AnyRecord } from "@/server/admin/resource";
import { getResource } from "@/server/admin/resources";
import { invalidate } from "@/server/cache";
import { requirePermission } from "@/lib/admin-guard";

function resourceOrThrow(key: string) {
  const resource = getResource(key);
  if (!resource) throw new AdminError("Cadastro não encontrado.");
  return resource;
}

/** Cria ou atualiza um registro de qualquer cadastro simples, com validação, auditoria e cache. */
export async function saveResourceAction(
  key: string,
  id: string | null,
  values: FormValues,
): Promise<AdminResult<{ redirect?: string }>> {
  const resource = getResource(key);
  if (!resource) return { ok: false, error: "Cadastro não encontrado." };
  return runAdmin<z.ZodType, { redirect?: string }>(
    resource.permission,
    resource.form.schema,
    values,
    async (data, context) => {
      const delegate = delegateOf(resource);
      const existing = id
        ? await delegate.findUnique({ where: { id }, include: resource.include })
        : null;
      if (id && !existing) throw new AdminError(`${resource.singular} não encontrado.`);
      if (!id && resource.canCreate === false)
        throw new AdminError("Não é possível criar por aqui.");
      let savedId: string;
      try {
        if (resource.form.save)
          savedId = (await resource.form.save(data as never, context, existing)).id;
        else
          savedId = (
            existing
              ? await delegate.update({ where: { id }, data })
              : await delegate.create({ data })
          ).id;
      } catch (error) {
        // Violação de campo único (código, endereço, caminho) vira mensagem clara.
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        )
          throw new AdminError("Já existe um cadastro com este código ou endereço.");
        throw error;
      }
      const plain = (typeof data === "object" && data !== null ? data : {}) as Record<
        string,
        unknown
      >;
      await context.audit({
        action: `${resource.model}.${existing ? "update" : "create"}`,
        entityType: resource.entityType,
        entityId: savedId,
        diff: JSON.parse(
          JSON.stringify(
            existing
              ? diffFields(existing, plain)
              : { criado: resource.nameOf({ ...plain, id: savedId } as AnyRecord) },
          ),
        ),
      });
      invalidate(...resource.tags);
      return {
        message: savedMessage(resource, !existing),
        data: { redirect: existing ? undefined : `/admin/${resource.key}/${savedId}` },
      };
    },
  );
}

const idSchema = z.object({ id: z.string().min(1).max(40) });

export async function deleteResourceAction(
  key: string,
  id: string,
): Promise<AdminResult<{ redirect?: string }>> {
  const resource = getResource(key);
  if (!resource) return { ok: false, error: "Cadastro não encontrado." };
  return runAdmin<typeof idSchema, { redirect?: string }>(
    resource.permission,
    idSchema,
    { id },
    async (data, context) => {
      if (resource.blockDelete === false)
        throw new AdminError("Este cadastro não pode ser excluído.");
      const delegate = delegateOf(resource);
      const record = await delegate.findUnique({
        where: { id: data.id },
        include: resource.include,
      });
      if (!record) throw new AdminError(`${resource.singular} não encontrado.`);
      const reason = resource.blockDelete ? await resource.blockDelete(record) : null;
      if (reason) throw new AdminError(reason);
      await delegate.delete({ where: { id: data.id } });
      await context.audit({
        action: `${resource.model}.delete`,
        entityType: resource.entityType,
        entityId: data.id,
        diff: { excluido: resource.nameOf(record) },
      });
      invalidate(...resource.tags);
      return {
        message: `${resource.singular} ${resource.feminine ? "excluída" : "excluído"}`,
        data: { redirect: `/admin/${resource.key}` },
      };
    },
  );
}

const toggleSchema = z.object({
  id: z.string().min(1).max(40),
  field: z.string().max(40),
  value: z.boolean(),
});

export async function toggleResourceAction(
  key: string,
  id: string,
  field: string,
  value: boolean,
): Promise<AdminResult> {
  const resource = getResource(key);
  if (!resource) return { ok: false, error: "Cadastro não encontrado." };
  return runAdmin(
    resource.permission,
    toggleSchema,
    { id, field, value },
    async (data, context) => {
      const toggle = resource.toggles?.find((item) => item.field === data.field);
      if (!toggle) throw new AdminError("Campo não permitido.");
      const record = await delegateOf(resource).update({
        where: { id: data.id },
        data: { [data.field]: data.value },
      });
      await context.audit({
        action: `${resource.model}.update`,
        entityType: resource.entityType,
        entityId: data.id,
        diff: { [data.field]: { antes: !data.value, depois: data.value } },
      });
      invalidate(...resource.tags);
      return {
        message: `${resource.nameOf(record)}: ${toggle.label.toLowerCase()} ${data.value ? "ligado" : "desligado"}`,
      };
    },
  );
}

const reorderSchema = z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(500) });

export async function reorderResourceAction(key: string, ids: string[]): Promise<AdminResult> {
  const resource = getResource(key);
  if (!resource) return { ok: false, error: "Cadastro não encontrado." };
  return runAdmin(resource.permission, reorderSchema, { ids }, async (data, context) => {
    await db.$transaction(async (tx) => {
      const delegate = delegateOf(resource, tx);
      for (const [position, id] of data.ids.entries())
        await delegate.update({ where: { id }, data: { position } });
    });
    await context.audit({
      action: `${resource.model}.reorder`,
      entityType: resource.entityType,
      diff: { ordem: data.ids },
    });
    invalidate(...resource.tags);
    return { message: "Ordem salva" };
  });
}

/** Prévia em texto calculada no servidor (cupom em linguagem simples, por exemplo). */
export async function describeResourceAction(key: string, values: FormValues): Promise<string> {
  const resource = resourceOrThrow(key);
  await requirePermission(resource.permission);
  return (await resource.form.describe?.(values)) ?? "";
}
