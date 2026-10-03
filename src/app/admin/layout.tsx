import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell, type ShellNav } from "@/components/admin/admin-shell";
import { ADMIN_NAV } from "@/components/admin/nav";
import { can, isStaff } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { getAttention } from "@/server/admin/dashboard";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // O proxy já barra quem não tem sessão; aqui o papel é conferido de novo, no banco.
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?voltar=/admin");
  if (!isStaff(user)) redirect("/conta");

  const [settings, attention] = await Promise.all([getStoreSettings(), getAttention()]);
  const counters = {
    lowStock: attention.lowStock + attention.zeroStock,
    pendingReviews: attention.pendingReviews,
    newRequests: attention.newRequests,
    unreadContacts: attention.unreadContacts,
    dataRequests: attention.dataRequests,
  };
  // A barra lateral só mostra o que o papel do usuário permite.
  const nav: ShellNav = ADMIN_NAV.map((section) => ({
    group: section.group,
    items: section.items
      .filter((item) => can(user, item.permission))
      .map((item) => ({
        href: item.href,
        label: item.label,
        count: item.counter ? counters[item.counter] : undefined,
      })),
  })).filter((section) => section.items.length > 0);

  return (
    <AdminShell
      nav={nav}
      storeName={settings.name}
      userName={user.name}
      roleLabel={user.role === "ADMIN" ? "Administrador" : "Equipe"}
    >
      {children}
    </AdminShell>
  );
}
