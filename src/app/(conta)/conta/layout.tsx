import { AccountNav } from "@/components/store/account/account-nav";
import { getCurrentUser } from "@/lib/session";

export default async function AccountLayout({ children }: LayoutProps<"/conta">) {
  // A página de avaliação aceita o link do e-mail sem login; as demais exigem conta.
  const user = await getCurrentUser();
  return (
    <div className="container-store pt-8 pb-16">
      {user ? (
        <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
          <AccountNav />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
