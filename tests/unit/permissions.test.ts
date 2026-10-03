import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, type Permission } from "@/lib/permissions";

const admin = { role: "ADMIN" as const };
const staff = { role: "STAFF" as const };
const customer = { role: "CUSTOMER" as const };
const all = Object.keys(PERMISSIONS) as Permission[];

describe("matriz de permissões (seção 12.2)", () => {
  it("ADMIN pode tudo", () => {
    for (const permission of all) expect(can(admin, permission), permission).toBe(true);
  });

  it("cliente e visitante não podem nada no painel", () => {
    for (const permission of all) {
      expect(can(customer, permission), permission).toBe(false);
      expect(can(null, permission), permission).toBe(false);
    }
  });

  it("STAFF em pedidos: vê, altera status, rastreio, notas, imprime e cria pedido manual; sem estorno", () => {
    for (const permission of [
      "orders.view",
      "orders.update_status",
      "orders.notes",
      "orders.print",
      "orders.create_manual",
    ] as const) {
      expect(can(staff, permission), permission).toBe(true);
    }
    expect(can(staff, "orders.refund")).toBe(false);
    expect(can(staff, "orders.override_price")).toBe(false);
    expect(can(staff, "orders.export")).toBe(false);
  });

  it("STAFF no catálogo: vê e edita estoque e imagens; sem excluir e sem alterar preço", () => {
    expect(can(staff, "products.view")).toBe(true);
    expect(can(staff, "products.edit_images")).toBe(true);
    expect(can(staff, "inventory.adjust")).toBe(true);
    for (const permission of [
      "products.edit",
      "products.edit_price",
      "products.delete",
      "products.view_cost",
      "products.remove_samples",
      "categories.edit",
      "media.delete",
    ] as const) {
      expect(can(staff, permission), permission).toBe(false);
    }
  });

  it("STAFF no estoque: tudo, menos o relatório de valor em estoque", () => {
    expect(can(staff, "inventory.view")).toBe(true);
    expect(can(staff, "inventory.value_report")).toBe(false);
  });

  it("STAFF em clientes: vê e adiciona notas; sem exportar, editar nem anonimizar", () => {
    expect(can(staff, "customers.view")).toBe(true);
    expect(can(staff, "customers.notes")).toBe(true);
    for (const permission of ["customers.export", "customers.edit", "customers.anonymize"] as const)
      expect(can(staff, permission)).toBe(false);
  });

  it("STAFF em marketing: avaliações, solicitações e leads (sem exportar); sem cupons, banners, home e páginas", () => {
    expect(can(staff, "reviews.manage")).toBe(true);
    expect(can(staff, "requests.manage")).toBe(true);
    expect(can(staff, "leads.view")).toBe(true);
    for (const permission of [
      "leads.export",
      "coupons.manage",
      "banners.manage",
      "home.manage",
      "pages.manage",
    ] as const)
      expect(can(staff, permission)).toBe(false);
  });

  it("STAFF não acessa frete, configurações, usuários, redirecionamentos, auditoria e e-mails", () => {
    for (const permission of [
      "shipping.manage",
      "settings.manage",
      "users.manage",
      "redirects.manage",
      "audit.view",
      "emails.view",
      "jobs.manage",
    ] as const) {
      expect(can(staff, permission), permission).toBe(false);
    }
  });

  it("STAFF vê o dashboard e os relatórios sem custo e margem", () => {
    expect(can(staff, "dashboard.view")).toBe(true);
    expect(can(staff, "dashboard.margin")).toBe(false);
    expect(can(staff, "reports.view")).toBe(true);
    expect(can(staff, "reports.margin")).toBe(false);
  });
});
