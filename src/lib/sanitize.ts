import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    b: "strong",
    i: "em",
    // Links externos sempre abrem com rel seguro.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      const safe: Record<string, string> = external
        ? { href, target: "_blank", rel: "noopener noreferrer" }
        : { href };
      return { tagName, attribs: safe };
    },
  },
};

/**
 * Sanitiza o HTML do editor de texto rico. É aplicado ao salvar e de novo ao renderizar:
 * só passam negrito, itálico, listas, links e títulos H2/H3.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, RICH_TEXT_OPTIONS).trim();
}

/** Texto puro, sem nenhuma tag. Para meta description, JSON-LD e contagem de caracteres. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
