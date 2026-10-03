/**
 * Configuração central da loja. É a única fonte de nome, contatos, regras comerciais e textos fixos.
 *
 * Estes são os valores padrão. O admin pode sobrescrevê-los em Configurações (tabela StoreSetting);
 * `getStoreSettings()` devolve a mescla. Nenhum componente deve escrever telefone, e-mail,
 * valor de frete grátis ou desconto diretamente: leia daqui.
 */

export type CepRange = { start: string; end: string };

/** 0 = domingo ... 6 = sábado, como em Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type StoreSettings = {
  name: string;
  tagline: string;
  legalName: string;
  cnpj: string;
  address: string;
  /** Número com código do país e DDD, só dígitos, como o wa.me espera. */
  whatsapp: string;
  phoneDisplay: string;
  email: string;
  /** E-mail que recebe as notificações internas (novo pedido, contato, estoque baixo). */
  notificationEmail: string;
  businessHours: string;
  instagram: string;
  partnerClaim: string;
  pixDiscountPercent: number;
  maxInstallments: number;
  minInstallmentCents: number;
  freeShippingThresholdCents: number;
  giftWrapPriceCents: number;
  sameDay: {
    enabled: boolean;
    /** HH:mm no fuso America/Sao_Paulo. */
    cutoffTime: string;
    days: Weekday[];
    cepRanges: CepRange[];
    /** Hora limite de entrega exibida ao cliente ("Receba hoje até 20h"). */
    deliverByHour: number;
  };
  pixExpirationMinutes: number;
  cartExpirationDays: number;
  lowStockDefaultThreshold: number;
  welcomeCoupon: string;
  welcomeCouponPercent: number;
  legacyWelcomeCoupon: string;
  /** Datas sem entrega local, no formato AAAA-MM-DD. Editável no admin (tabela Holiday). */
  holidays: string[];
  /** Texto do acordeão "Entrega e embalagem" na página de produto. */
  packagingText: string;
  maintenanceMode: boolean;
  analytics: { ga4Id: string; metaPixelId: string };
};

export const TIME_ZONE = "America/Sao_Paulo";

export const storeConfig: StoreSettings = {
  name: "Net Shop Garden",
  tagline: "Plantas, orquídeas e arranjos com curadoria Shopping Garden", // TODO(dono): confirmar
  legalName: "[RAZÃO SOCIAL]", // TODO(dono): confirmar (exigido no rodapé pelo Decreto 7.962/2013)
  cnpj: "[00.000.000/0001-00]", // TODO(dono): confirmar
  address: "[Endereço completo]", // TODO(dono): confirmar
  whatsapp: "5511955817159", // TODO(dono): confirmar (número do site atual)
  phoneDisplay: "(11) 95581-7159", // TODO(dono): confirmar
  email: "contato@netshopgarden.com.br", // TODO(dono): confirmar (e-mail em domínio próprio)
  notificationEmail: "contato@netshopgarden.com.br", // TODO(dono): confirmar
  businessHours: "Segunda a sexta, das 9h às 17h", // TODO(dono): confirmar sábado
  instagram: "", // TODO(dono): informar a URL do perfil
  partnerClaim: "Parceira oficial de e-commerce do Shopping Garden, desde 1999 em São Paulo", // TODO(dono): confirmar
  pixDiscountPercent: 5, // TODO(dono): confirmar
  maxInstallments: 6, // TODO(dono): confirmar
  minInstallmentCents: 3000, // TODO(dono): confirmar
  freeShippingThresholdCents: 29900, // TODO(dono): confirmar
  giftWrapPriceCents: 1500, // TODO(dono): confirmar
  sameDay: {
    enabled: true,
    cutoffTime: "14:00", // TODO(dono): confirmar
    days: [1, 2, 3, 4, 5, 6], // TODO(dono): confirmar (segunda a sábado)
    cepRanges: [
      { start: "01000000", end: "05999999" },
      { start: "08000000", end: "08499999" },
    ], // TODO(dono): confirmar (capital de SP)
    deliverByHour: 20, // TODO(dono): confirmar
  },
  pixExpirationMinutes: 30,
  cartExpirationDays: 30,
  lowStockDefaultThreshold: 3,
  welcomeCoupon: "BEMVINDO10", // TODO(dono): confirmar
  welcomeCouponPercent: 10, // TODO(dono): confirmar
  legacyWelcomeCoupon: "NETSHOPGARDENBEMVINDO",
  holidays: [],
  packagingText:
    "Plantas e orquídeas viajam em embalagem própria, com proteção para o vaso, as hastes e as folhas. Vasos, cachepots e peças frágeis recebem proteção individual contra impacto. Se algo chegar com avaria, envie fotos em até 48 horas e resolvemos.", // TODO(dono): revisar
  maintenanceMode: false,
  analytics: { ga4Id: "", metaPixelId: "" },
};
