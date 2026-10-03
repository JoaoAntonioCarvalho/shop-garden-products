import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { requireAdminPage } from "@/lib/admin-guard";
import { getResource } from "@/server/admin/resources";

type Props = PageProps<"/admin/[recurso]/novo">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resource = getResource((await params).recurso);
  return {
    title: resource
      ? `${resource.feminine ? "Nova" : "Novo"} ${resource.singular.toLowerCase()}`
      : "Painel",
  };
}

export default async function NewResourcePage({ params, searchParams }: Props) {
  const resource = getResource((await params).recurso);
  if (!resource || resource.canCreate === false) notFound();
  const user = await requireAdminPage(resource.permission);
  const query = await searchParams;
  // Atalhos preenchem o formulário: "Criar redirecionamento" a partir de uma página não encontrada.
  const prefill =
    typeof query.origem === "string" ? { fromPath: query.origem.slice(0, 500) } : undefined;
  return <ResourceEditor resource={resource} record={null} user={user} prefill={prefill} />;
}
