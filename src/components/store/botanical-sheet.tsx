import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export type SheetRow = {
  label: string;
  value: string;
  /** Mostra o ícone de alerta (por exemplo "tóxico para pets"). */
  alert?: boolean;
};

type BotanicalSheetProps = {
  /** "Ficha botânica" para plantas e orquídeas, "Ficha técnica" para vasos, cachepots e artificiais. */
  heading: string;
  /** Nome popular (plantas) ou nome do produto. */
  title: string;
  scientificName?: string | null;
  rows: SheetRow[];
  /** Código do produto, exibido no rodapé da ficha. */
  sku: string;
  headingLevel?: "h2" | "h3";
  className?: string;
};

/**
 * Elemento memorável do site, inspirado nas etiquetas de herbário: fundo creme, borda fina musgo,
 * cantos retos, linha dupla no topo e conteúdo em duas colunas.
 */
export function BotanicalSheet({
  heading,
  title,
  scientificName,
  rows,
  sku,
  headingLevel = "h2",
  className,
}: BotanicalSheetProps) {
  const Heading = headingLevel;
  return (
    <section
      aria-label={heading}
      className={cn("border border-moss-700 bg-cream-100 p-5 md:p-7", className)}
    >
      <div className="herbarium-rule" aria-hidden="true" />
      <p className="mt-4 type-caption text-ink-muted">{heading}</p>
      <Heading className="mt-1 font-serif text-[26px] leading-tight font-semibold text-moss-900">
        {title}
      </Heading>
      {scientificName ? (
        <p className="type-scientific text-[20px] leading-snug text-moss-700">{scientificName}</p>
      ) : null}

      <dl className="mt-5 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="border-t border-line py-3">
            <dt className="type-caption text-ink-muted">{row.label}</dt>
            <dd className="mt-0.5 flex items-start gap-1.5 type-small font-medium text-ink">
              {row.alert ? (
                <TriangleAlert
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="mt-0.5 size-4 flex-none text-warning"
                />
              ) : null}
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 flex flex-wrap justify-between gap-x-4 border-t border-moss-700 pt-3 type-caption text-ink-muted">
        <span>Curadoria Shopping Garden</span>
        <span className="tabular-nums">Código {sku}</span>
      </p>
    </section>
  );
}

/** Versão reduzida da ficha, usada como legenda da foto do hero. */
export function BotanicalCaption({
  commonName,
  scientificName,
  className,
}: {
  commonName: string;
  scientificName?: string | null;
  className?: string;
}) {
  return (
    <p
      className={cn("inline-block border border-moss-700 bg-cream-100 px-3 pt-1.5 pb-2", className)}
    >
      <span className="mb-1.5 block herbarium-rule" aria-hidden="true" />
      <span className="block type-caption font-medium text-ink">{commonName}</span>
      {scientificName ? (
        <span className="block type-scientific text-[22px] leading-none text-moss-700">
          {scientificName}
        </span>
      ) : null}
    </p>
  );
}
