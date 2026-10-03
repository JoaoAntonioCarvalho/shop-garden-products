import type { StoreSettings } from "@/config/store.config";
import { cn } from "@/lib/cn";
import { sanitizeRichText } from "@/lib/sanitize";
import { renderTokens } from "@/lib/template";

type RichTextProps = {
  html: string | null | undefined;
  /** Quando informado, preenche os {{marcadores}} com a configuração da loja. */
  settings?: StoreSettings;
  className?: string;
};

/** Renderiza HTML do editor de texto rico. Sempre sanitizado antes de ir para a página. */
export function RichText({ html, settings, className }: RichTextProps) {
  const safe = sanitizeRichText(settings && html ? renderTokens(html, settings) : html);
  if (!safe) return null;
  return <div className={cn("rich-text", className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}
