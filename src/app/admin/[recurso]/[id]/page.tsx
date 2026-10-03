import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { requireAdminPage } from "@/lib/admin-guard";
import { delegateOf } from "@/server/admin/resource";
import { getResource } from "@/server/admin/resources";

type Props = PageProps<"/admin/[recurso]/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getResource((await params).recurso)?.singular ?? "Painel" };
}

export default async function EditResourcePage({ params }: Props) {
  const { recurso, id } = await params;
  const resource = getResource(recurso);
  if (!resource) notFound();
  const user = await requireAdminPage(resource.permission);
  const record = await delegateOf(resource).findUnique({
    where: { id },
    include: resource.include,
  });
  if (!record) notFound();
  return <ResourceEditor resource={resource} record={record} user={user} />;
}
