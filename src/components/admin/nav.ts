import type { Permission } from "@/lib/permissions";

export type AdminNavItem = {
  href: string;
  label: string;
  permission: Permission;
  counter?: "lowStock" | "pendingReviews" | "newRequests" | "unreadContacts" | "dataRequests";
};

/** Módulos do painel, agrupados como na seção 12.1. Cada item só aparece para quem tem a permissão. */
export const ADMIN_NAV: Array<{ group: string; items: AdminNavItem[] }> = [
  {
    group: "Vendas",
    items: [
      { href: "/admin", label: "Dashboard", permission: "dashboard.view" },
      { href: "/admin/pedidos", label: "Pedidos", permission: "orders.view" },
      { href: "/admin/carrinhos", label: "Carrinhos abandonados", permission: "carts.view" },
      { href: "/admin/relatorios", label: "Relatórios", permission: "reports.view" },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { href: "/admin/produtos", label: "Produtos", permission: "products.view" },
      { href: "/admin/curadoria", label: "Curadoria", permission: "products.view" },
      { href: "/admin/categorias", label: "Categorias", permission: "categories.view" },
      { href: "/admin/colecoes", label: "Coleções", permission: "collections.view" },
      {
        href: "/admin/estoque",
        label: "Estoque",
        permission: "inventory.view",
        counter: "lowStock",
      },
      { href: "/admin/midia", label: "Mídia", permission: "media.view" },
    ],
  },
  {
    group: "Clientes",
    items: [
      { href: "/admin/clientes", label: "Clientes", permission: "customers.view" },
      {
        href: "/admin/avaliacoes",
        label: "Avaliações",
        permission: "reviews.manage",
        counter: "pendingReviews",
      },
      { href: "/admin/leads", label: "Leads", permission: "leads.view" },
      {
        href: "/admin/solicitacoes",
        label: "Solicitações",
        permission: "requests.manage",
        counter: "newRequests",
      },
      {
        href: "/admin/contatos",
        label: "Contatos",
        permission: "requests.manage",
        counter: "unreadContacts",
      },
      { href: "/admin/avise-me", label: "Avise-me", permission: "requests.manage" },
      {
        href: "/admin/dados-pessoais",
        label: "Pedidos LGPD",
        permission: "data_requests.manage",
        counter: "dataRequests",
      },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/admin/cupons", label: "Cupons", permission: "coupons.manage" },
      { href: "/admin/banners", label: "Banners", permission: "banners.manage" },
      { href: "/admin/home", label: "Home", permission: "home.manage" },
      { href: "/admin/ocasioes", label: "Ocasiões", permission: "home.manage" },
      { href: "/admin/depoimentos", label: "Depoimentos", permission: "reviews.manage" },
    ],
  },
  {
    group: "Conteúdo",
    items: [
      { href: "/admin/paginas", label: "Páginas", permission: "pages.manage" },
      { href: "/admin/ajuda", label: "Ajuda (FAQ)", permission: "pages.manage" },
    ],
  },
  {
    group: "Configurações",
    items: [
      { href: "/admin/frete", label: "Frete e entrega", permission: "shipping.manage" },
      {
        href: "/admin/areas-de-entrega",
        label: "Áreas de entrega",
        permission: "shipping.manage",
      },
      { href: "/admin/configuracoes", label: "Configurações", permission: "settings.manage" },
      { href: "/admin/usuarios", label: "Usuários", permission: "users.manage" },
      {
        href: "/admin/redirecionamentos",
        label: "Redirecionamentos",
        permission: "redirects.manage",
      },
      { href: "/admin/auditoria", label: "Auditoria", permission: "audit.view" },
      { href: "/admin/emails", label: "E-mails enviados", permission: "emails.view" },
      { href: "/admin/tarefas", label: "Tarefas agendadas", permission: "jobs.manage" },
    ],
  },
];
