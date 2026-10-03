import type { ReactNode } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { EntityForm } from "@/components/admin/entity-form";
import { getEnv } from "@/lib/env";
import type { CurrentUser } from "@/lib/session";
import {
  deleteResourceAction,
  describeResourceAction,
  saveResourceAction,
} from "@/server/actions/admin/resources";
import type { AnyRecord, Resource } from "@/server/admin/resource";

/** Página de criação ou edição de um cadastro simples. */
export async function ResourceEditor({
  resource,
  record,
  user,
  prefill,
}: {
  resource: Resource;
  record: AnyRecord | null;
  user: CurrentUser;
  prefill?: Record<string, unknown>;
}) {
  const [fields, initial] = await Promise.all([
    resource.form.fields(record),
    resource.form.toForm(record),
  ]);
  const below: ReactNode = record ? await resource.form.below?.(record, user) : null;
  const name = record ? resource.nameOf(record) : null;
  return (
    <>
      <PageHeader
        back={{ href: `/admin/${resource.key}`, label: resource.plural }}
        title={name ?? `${resource.feminine ? "Nova" : "Novo"} ${resource.singular.toLowerCase()}`}
        actions={
          record && resource.blockDelete !== false ? (
            <ActionButton
              variant="destructive"
              action={deleteResourceAction.bind(null, resource.key, record.id)}
              redirectOnDone
              confirm={{
                title: `Excluir ${resource.singular.toLowerCase()}`,
                description: `${name} será ${resource.feminine ? "excluída" : "excluído"} de vez. Não dá para desfazer.`,
                confirmLabel: "Excluir",
              }}
            >
              Excluir
            </ActionButton>
          ) : null
        }
      />
      <EntityForm
        key={record?.id ?? "novo"}
        fields={fields}
        initial={{ ...initial, ...prefill }}
        action={saveResourceAction.bind(null, resource.key, record?.id ?? null)}
        describe={
          resource.form.describe ? describeResourceAction.bind(null, resource.key) : undefined
        }
        preview={resource.form.livePreview}
        seo={
          resource.form.seoUrl
            ? {
                url: `${getEnv().APP_URL}${resource.form.seoUrl(initial)}`,
                fallbackTitleField: "name" in initial ? "name" : "title",
              }
            : undefined
        }
      >
        {below}
      </EntityForm>
    </>
  );
}
