/** Link do WhatsApp com mensagem pré-preenchida. O número vem sempre da configuração da loja. */
export function buildWhatsAppUrl(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/** Acrescenta os parâmetros de rastreio à URL de produto enviada na mensagem. */
export function withWhatsAppUtm(url: string, content: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("utm_source", "site");
  parsed.searchParams.set("utm_medium", "whatsapp_button");
  parsed.searchParams.set("utm_content", content);
  return parsed.toString();
}
