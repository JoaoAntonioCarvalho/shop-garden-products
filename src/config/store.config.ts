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
  /** Endereço da loja onde o pedido é retirado. Usado no checkout quando o cliente escolhe retirar. */
  pickupAddress: {
    cep: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
  };
  /** Número com código do país e DDD, só dígitos, como o wa.me espera. */
  whatsapp: string;
  phoneDisplay: string;
  email: string;
  /** E-mail que recebe as notificações internas (novo pedido, contato, estoque baixo). */
  notificationEmail: string;
  businessHours: string;
  /** Orientações e horário da retirada na loja, mostrados no frete, no checkout, na página de Entrega e na Ajuda. */
  pickupInstructions: string;
  /** Texto da entrega própria nas opções de frete (dias e horário). */
  ownDeliveryNote: string;
  /** Prazo de separação e envio, mostrado na confirmação do pedido e no e-mail de pagamento aprovado. */
  orderHandlingNotice: string;
  instagram: string;
  partnerClaim: string;
  pixDiscountPercent: number;
  maxInstallments: number;
  minInstallmentCents: number;
  freeShippingThresholdCents: number;
  /** A loja oferece embalagem para presente paga. Desligada, a opção some da sacola. */
  giftWrapEnabled: boolean;
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
  pickupAddress: {
    cep: "04071-001",
    street: "Av. dos Bandeirantes",
    number: "5900",
    district: "Planalto Paulista",
    city: "São Paulo",
    state: "SP",
  },
  whatsapp: "5511955817159", // TODO(dono): confirmar (número do site atual)
  phoneDisplay: "(11) 95581-7159", // TODO(dono): confirmar
  email: "netshopgarden@gmail.com",
  notificationEmail: "netshopgarden@gmail.com",
  businessHours: "Segunda a sexta, das 9h às 17h. Sábado, das 9h às 14h30",
  instagram: "https://www.instagram.com/netshopgarden",
  pickupInstructions:
    "Aguarde o e-mail avisando que o pedido está pronto antes de ir até a loja. Retirada até as 16h.",
  ownDeliveryNote:
    "Equipe própria, de segunda a sexta, em horário comercial. Avisamos antes de sair.",
  orderHandlingNotice: "Temos até 3 dias úteis para separar e enviar o seu pedido.",
  partnerClaim: "Parceira oficial de e-commerce do Shopping Garden, desde 1999 em São Paulo",
  pixDiscountPercent: 5,
  maxInstallments: 6,
  minInstallmentCents: 5000,
  freeShippingThresholdCents: 39900,
  giftWrapEnabled: false, // a loja não tem embalagem para presente paga (resposta da dona, 11/10/2026)
  giftWrapPriceCents: 1500,
  sameDay: {
    enabled: false, // a loja não entrega no mesmo dia (dona, 12/10/2026)
    cutoffTime: "14:00", // TODO(dono): confirmar
    days: [1, 2, 3, 4, 5, 6], // TODO(dono): confirmar (segunda a sábado)
    cepRanges: [
      { start: "01000000", end: "05999999" },
      { start: "08000000", end: "08499999" },
    ], // TODO(dono): confirmar (capital de SP)
    deliverByHour: 20, // TODO(dono): confirmar
  },
  // Igual à validade do QR Code na Cielo (2 horas): pagar depois de o pedido expirar deixaria o dinheiro sem pedido.
  pixExpirationMinutes: 120,
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
