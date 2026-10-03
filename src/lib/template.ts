import type { StoreSettings } from "@/config/store.config";
import { formatBRL, formatBRLShort } from "@/lib/money";

/** "14:00" → "14h", "14:30" → "14h30" */
export function formatCutoff(time: string): string {
  const [hours, minutes] = time.split(":");
  return minutes === "00" ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`;
}

/** Valores disponíveis como {{marcador}} em páginas, FAQ, banners e seções da home. */
export function templateValues(settings: StoreSettings): Record<string, string> {
  return {
    nome: settings.name,
    razaoSocial: settings.legalName,
    cnpj: settings.cnpj,
    endereco: settings.address,
    telefone: settings.phoneDisplay,
    email: settings.email,
    horario: settings.businessHours,
    corte: formatCutoff(settings.sameDay.cutoffTime),
    descontoPix: String(settings.pixDiscountPercent),
    freteGratis: formatBRLShort(settings.freeShippingThresholdCents),
    parcelas: String(settings.maxInstallments),
    parcelaMinima: formatBRLShort(settings.minInstallmentCents),
    embalagemPresente: formatBRL(settings.giftWrapPriceCents),
    expiracaoPix: String(settings.pixExpirationMinutes),
    cupomBoasVindas: settings.welcomeCoupon,
    descontoBoasVindas: String(settings.welcomeCouponPercent),
  };
}

/**
 * Preenche os {{marcadores}} de um texto com a configuração da loja. Assim nenhum prazo, desconto
 * ou contato fica escrito no conteúdo. Marcadores desconhecidos são mantidos, para aparecerem na revisão.
 */
export function renderTokens(text: string, settings: StoreSettings): string {
  const values = templateValues(settings);
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}
