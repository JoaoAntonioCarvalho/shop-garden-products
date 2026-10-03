import type { UserRole } from "@/lib/credentials";

/**
 * Matriz única de permissões do painel (seção 12.2). A mesma função `can` esconde elementos da
 * interface e bloqueia no servidor (páginas, server actions e route handlers).
 */
export const PERMISSIONS = {
  // Dashboard
  "dashboard.view": ["ADMIN", "STAFF"],
  "dashboard.margin": ["ADMIN"],
  // Pedidos
  "orders.view": ["ADMIN", "STAFF"],
  "orders.update_status": ["ADMIN", "STAFF"],
  "orders.notes": ["ADMIN", "STAFF"],
  "orders.print": ["ADMIN", "STAFF"],
  "orders.create_manual": ["ADMIN", "STAFF"],
  "orders.mark_paid": ["ADMIN", "STAFF"],
  "orders.reveal_cpf": ["ADMIN", "STAFF"],
  "orders.resend_email": ["ADMIN", "STAFF"],
  "orders.refund": ["ADMIN"],
  "orders.override_price": ["ADMIN"],
  "orders.export": ["ADMIN"],
  // Catálogo
  "products.view": ["ADMIN", "STAFF"],
  "products.edit": ["ADMIN"],
  "products.edit_images": ["ADMIN", "STAFF"],
  "products.edit_price": ["ADMIN"],
  "products.view_cost": ["ADMIN"],
  "products.delete": ["ADMIN"],
  "products.import": ["ADMIN"],
  "products.export": ["ADMIN"],
  "products.remove_samples": ["ADMIN"],
  "categories.view": ["ADMIN", "STAFF"],
  "categories.edit": ["ADMIN"],
  "collections.view": ["ADMIN", "STAFF"],
  "collections.edit": ["ADMIN"],
  "media.view": ["ADMIN", "STAFF"],
  "media.upload": ["ADMIN", "STAFF"],
  "media.delete": ["ADMIN"],
  // Estoque
  "inventory.view": ["ADMIN", "STAFF"],
  "inventory.adjust": ["ADMIN", "STAFF"],
  "inventory.value_report": ["ADMIN"],
  // Clientes
  "customers.view": ["ADMIN", "STAFF"],
  "customers.notes": ["ADMIN", "STAFF"],
  "customers.edit": ["ADMIN"],
  "customers.export": ["ADMIN"],
  "customers.anonymize": ["ADMIN"],
  "carts.view": ["ADMIN"],
  "carts.recover": ["ADMIN"],
  // Marketing e conteúdo
  "coupons.manage": ["ADMIN"],
  "banners.manage": ["ADMIN"],
  "home.manage": ["ADMIN"],
  "pages.manage": ["ADMIN"],
  "reviews.manage": ["ADMIN", "STAFF"],
  "leads.view": ["ADMIN", "STAFF"],
  "leads.export": ["ADMIN"],
  "requests.manage": ["ADMIN", "STAFF"],
  // Sistema
  "shipping.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "users.manage": ["ADMIN"],
  "redirects.manage": ["ADMIN"],
  "reports.view": ["ADMIN", "STAFF"],
  "reports.margin": ["ADMIN"],
  "audit.view": ["ADMIN"],
  "emails.view": ["ADMIN"],
  "jobs.manage": ["ADMIN"],
  "data_requests.manage": ["ADMIN"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(user: { role: UserRole } | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(user.role);
}

export function isStaff(user: { role: UserRole } | null | undefined): boolean {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}
