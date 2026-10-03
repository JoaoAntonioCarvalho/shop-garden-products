import "server-only";
import type { ReactNode } from "react";
import type { z } from "zod";
import type { DataColumn } from "@/components/admin/data-table";
import type { FieldDef, FormValues } from "@/components/admin/entity-form";
import type { FilterField } from "@/components/admin/filter-bar";
import { db } from "@/lib/db";
import type { Permission } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import type { AdminContext } from "./action";
import type { ListParams } from "./list";

export type AnyRecord = { id: string } & Record<string, unknown>;

/**
 * Um cadastro simples do painel (cupons, banners, páginas, regras de frete...). A definição diz
 * como listar, que campos o formulário tem e como validar; as páginas e as ações são genéricas
 * (src/app/admin/[recurso] e src/server/actions/admin/resources.ts).
 */
export type Resource<R extends AnyRecord = AnyRecord> = {
  /** Segmento da URL: /admin/[key]. */
  key: string;
  singular: string;
  plural: string;
  description?: string;
  /** Artigo para as mensagens: "Cupom salvo", "Página salva". */
  feminine?: boolean;
  permission: Permission;
  /** Nome do model no cliente Prisma: "coupon", "banner"... */
  model: string;
  entityType: string;
  /** Tags de cache da loja invalidadas a cada alteração. */
  tags: string[];
  nameOf(record: R): string;
  include?: Record<string, unknown>;
  list: {
    columns: DataColumn[];
    orderBy: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
    sortable?: string[];
    searchPlaceholder?: string;
    filters?(): Promise<FilterField[]> | FilterField[];
    where?(params: ListParams): Record<string, unknown> | Promise<Record<string, unknown>>;
    /** Células da linha. A primeira coluna vira o link para a edição. */
    row(record: R, user: CurrentUser): Record<string, ReactNode>;
    /** Conteúdo acima da lista (geradores, abas, avisos). */
    above?(user: CurrentUser): Promise<ReactNode> | ReactNode;
    /** Lista ordenável por arrastar em vez de tabela paginada. */
    reorder?: boolean;
    exportKey?: string;
  };
  form: {
    fields(record: R | null): Promise<FieldDef[]> | FieldDef[];
    schema: z.ZodType;
    toForm(record: R | null): Promise<FormValues> | FormValues;
    /** Gravação própria quando há relações ou regras; o padrão é create/update com os dados validados. */
    save?(data: never, context: AdminContext, existing: R | null): Promise<{ id: string }>;
    /** Texto de prévia calculado no servidor a partir dos valores digitados. */
    describe?(values: FormValues): Promise<string> | string;
    seoUrl?(values: FormValues): string;
    /** Conteúdo abaixo do formulário de edição (relatórios, prévia, itens). */
    below?(record: R, user: CurrentUser): Promise<ReactNode> | ReactNode;
  };
  /** Campos booleanos alternáveis direto na lista. */
  toggles?: Array<{ field: string; label: string }>;
  canCreate?: boolean;
  /** Motivo que impede a exclusão, ou null se pode excluir. False desliga a exclusão. */
  blockDelete?: false | ((record: R) => Promise<string | null> | string | null);
};

type Delegate = {
  findMany(args?: unknown): Promise<AnyRecord[]>;
  findUnique(args: unknown): Promise<AnyRecord | null>;
  count(args?: unknown): Promise<number>;
  create(args: unknown): Promise<AnyRecord>;
  update(args: unknown): Promise<AnyRecord>;
  delete(args: unknown): Promise<AnyRecord>;
};

export function delegateOf(resource: Resource, client: unknown = db): Delegate {
  return (client as Record<string, Delegate>)[resource.model];
}

/** Guarda o tipo do registro dentro da definição e devolve o tipo genérico do registro. */
export function defineResource<R extends AnyRecord>(resource: Resource<R>): Resource {
  return resource as unknown as Resource;
}

export const savedMessage = (resource: Resource, created: boolean) =>
  `${resource.singular} ${created ? (resource.feminine ? "criada" : "criado") : resource.feminine ? "salva" : "salvo"}`;
