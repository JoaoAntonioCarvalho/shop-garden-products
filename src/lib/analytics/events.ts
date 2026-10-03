/**
 * Camada única de eventos. Todo evento vai para window.dataLayer; GA4 e Meta Pixel só recebem
 * quando o visitante consentiu (os scripts só são carregados após o consentimento, então
 * window.gtag e window.fbq simplesmente não existem antes disso).
 */

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  /** Em reais, como o GA4 espera. */
  price: number;
  quantity: number;
};

export type WhatsAppPosition =
  "flutuante" | "produto" | "hero" | "checkout" | "pedido" | "menu" | "pagina";

export type AnalyticsEvents = {
  view_item_list: { item_list_name: string; items: AnalyticsItem[] };
  select_item: { item_list_name: string; items: AnalyticsItem[] };
  view_item: { currency: "BRL"; value: number; items: AnalyticsItem[] };
  add_to_wishlist: { currency: "BRL"; value: number; items: AnalyticsItem[] };
  add_to_cart: { currency: "BRL"; value: number; items: AnalyticsItem[] };
  remove_from_cart: { currency: "BRL"; value: number; items: AnalyticsItem[] };
  view_cart: { currency: "BRL"; value: number; items: AnalyticsItem[] };
  begin_checkout: { currency: "BRL"; value: number; coupon?: string; items: AnalyticsItem[] };
  add_shipping_info: {
    currency: "BRL";
    value: number;
    shipping_tier: string;
    items: AnalyticsItem[];
  };
  add_payment_info: {
    currency: "BRL";
    value: number;
    payment_type: string;
    items: AnalyticsItem[];
  };
  purchase: {
    transaction_id: string;
    currency: "BRL";
    value: number;
    shipping: number;
    coupon?: string;
    items: AnalyticsItem[];
  };
  search: { search_term: string };
  generate_lead: { lead_source: string };
  whatsapp_click: { position: WhatsAppPosition; page: string };
  sign_up: { method: "email" };
  login: { method: "email" };
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const metaEventNames: Partial<Record<keyof AnalyticsEvents, string>> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  add_to_wishlist: "AddToWishlist",
  begin_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo",
  purchase: "Purchase",
  search: "Search",
  generate_lead: "Lead",
  sign_up: "CompleteRegistration",
};

export function track<E extends keyof AnalyticsEvents>(event: E, data: AnalyticsEvents[E]): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...data });

  window.gtag?.("event", event, data);

  const metaName = metaEventNames[event];
  if (metaName) window.fbq?.("track", metaName, data);
  else window.fbq?.("trackCustom", event, data);

  if (process.env.NODE_ENV === "development" && !window.gtag && !window.fbq) {
    console.debug("[analytics]", event, data);
  }
}
