"use client";

import {
  Ban,
  Check,
  ChevronRight,
  ImageOff,
  RotateCcw,
  Star,
  Trash2,
  Undo2,
  X as CloseIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { selectClass } from "@/components/admin/entity-form";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatBRL } from "@/lib/money";
import {
  decideProductsAction,
  importLegacyPhotosAction,
  renameProductAction,
  restoreProductsAction,
  setProductPriceAction,
  setProductsCarrierAction,
  setProductsCategoryAction,
  trashProductsAction,
} from "@/server/actions/admin/curation";
import type { CurationItem, CurationTab } from "@/server/admin/curation";

type Option = { value: string; label: string };
type Permissions = { edit: boolean; price: boolean; remove: boolean; images: boolean };
type Move = "keep" | "feature" | "unfeature" | "pending" | "invalid" | "trash" | "restore";

/** A decisão tira o produto da aba que está aberta? */
const leavesTab: Record<CurationTab, Move[]> = {
  revisar: ["keep", "feature", "invalid", "trash"],
  mantidos: ["pending", "invalid", "trash"],
  destaques: ["unfeature", "pending", "invalid", "trash"],
  invalidos: ["keep", "feature", "pending", "trash"],
  excluidos: ["restore"],
};

/** O que desfaz cada decisão, conforme a aba de onde ela partiu. */
function inverseOf(move: Move, tab: CurationTab): Move {
  if (move === "trash") return "restore";
  if (move === "restore") return "trash";
  if (move === "unfeature") return "feature";
  if (move === "invalid") return tab === "revisar" ? "pending" : "keep";
  if (move === "pending") return tab === "invalidos" ? "invalid" : "keep";
  // Manter ou destacar: volta para onde o produto estava.
  if (tab === "revisar") return "pending";
  return tab === "invalidos" ? "invalid" : "unfeature";
}

const deletedFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function Photo({ item, className }: { item: CurationItem; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!item.image || broken)
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-6" aria-hidden />
        <span className="text-xs">Sem foto</span>
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a foto pode ainda estar no site antigo, só no painel
    <img
      // Se a foto falhou antes de a página ficar interativa, o onError já passou.
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0) setBroken(true);
      }}
      src={item.image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn("bg-muted object-cover", className)}
    />
  );
}

/** Campo que parece texto e vira caixa de edição ao focar. Salva ao sair ou com Enter. */
function InlineField({
  label,
  value,
  onSave,
  disabled,
  multiline,
  prefix,
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<boolean>;
  disabled?: boolean;
  multiline?: boolean;
  prefix?: string;
  inputMode?: "decimal";
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  if (saved !== value) {
    // O servidor devolveu um valor novo (outra pessoa editou, ou a página recarregou).
    setSaved(value);
    setDraft(value);
  }
  const commit = async () => {
    const next = draft.trim();
    if (next === value.trim()) return setDraft(value);
    if (!(await onSave(next))) setDraft(value);
  };
  const shared = {
    "aria-label": label,
    value: draft,
    disabled,
    onBlur: commit,
    className: cn(
      "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 outline-none",
      "hover:border-input focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "disabled:hover:border-transparent",
      className,
    ),
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      (event.currentTarget as HTMLElement).blur();
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      setDraft(value);
    }
  };
  if (multiline)
    return (
      <textarea
        {...shared}
        rows={2}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        className={cn(shared.className, "resize-none leading-snug")}
      />
    );
  return (
    <span className="flex items-center">
      {prefix ? <span className="pl-1.5 text-sm text-muted-foreground">{prefix}</span> : null}
      <input
        {...shared}
        inputMode={inputMode}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </span>
  );
}

/** Marca na hora e desfaz se o servidor recusar. */
function CarrierToggle({
  name,
  value,
  disabled,
  onSave,
}: {
  name: string;
  value: boolean;
  disabled?: boolean;
  onSave: (value: boolean) => Promise<boolean>;
}) {
  const [checked, setChecked] = useState(value);
  const [saved, setSaved] = useState(value);
  if (saved !== value) {
    setSaved(value);
    setChecked(value);
  }
  return (
    <label className="flex min-h-7 cursor-pointer items-center gap-2 px-1.5 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        aria-label={`Não entregue pelos Correios: ${name}`}
        checked={checked}
        disabled={disabled}
        onChange={async (event) => {
          const next = event.target.checked;
          setChecked(next);
          if (!(await onSave(next))) setChecked(!next);
        }}
      />
      <span aria-hidden>Não entregue pelos Correios</span>
    </label>
  );
}

export function CurationBoard({
  items,
  total,
  tab,
  categories,
  permissions,
  photosPending,
  hasMore,
}: {
  items: CurationItem[];
  total: number;
  tab: CurationTab;
  categories: Option[];
  permissions: Permissions;
  photosPending: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);
  const lastMove = useRef<{ move: Move; ids: string[] } | null>(null);

  const visible = items.filter((item) => !hidden.has(item.id));
  const chosen = visible.filter((item) => selected.has(item.id)).map((item) => item.id);
  const current = visible.find((item) => !skipped.has(item.id)) ?? null;

  const run = useCallback(
    (move: Move, ids: string[], options: { undoing?: boolean } = {}) => {
      if (ids.length === 0) return;
      const leaves = !options.undoing && leavesTab[tab].includes(move);
      if (leaves) setHidden((previous) => new Set([...previous, ...ids]));
      setSelected((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
      startTransition(async () => {
        const result =
          move === "trash"
            ? await trashProductsAction(ids)
            : move === "restore"
              ? await restoreProductsAction(ids)
              : await decideProductsAction({ ids, decision: move });
        if (!result.ok) {
          setHidden((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
          toast(result.error, { tone: "error" });
          return;
        }
        if (options.undoing) {
          lastMove.current = null;
          setHidden((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
          toast("Desfeito");
        } else {
          const undo = { move: inverseOf(move, tab), ids };
          lastMove.current = undo;
          toast(result.message, {
            action: {
              label: "Desfazer",
              onClick: () => run(undo.move, undo.ids, { undoing: true }),
            },
          });
        }
        router.refresh();
      });
    },
    [router, tab],
  );

  const undoLast = useCallback(() => {
    const last = lastMove.current;
    if (last) run(last.move, last.ids, { undoing: true });
  }, [run]);

  const save = async (action: Promise<{ ok: boolean; message?: string; error?: string }>) => {
    const result = await action;
    if (result.ok) {
      if (result.message !== "Nada foi alterado") toast(result.message ?? "Salvo");
      router.refresh();
    } else toast(result.error ?? "Não foi possível salvar.", { tone: "error" });
    return result.ok;
  };

  // Atalhos do modo um por um. Não valem enquanto se digita em um campo.
  useEffect(() => {
    if (!reviewing || !current) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "m" && permissions.edit) run("keep", [current.id]);
      else if (key === "d" && permissions.edit) run("feature", [current.id]);
      else if (key === "x" && permissions.remove) run("trash", [current.id]);
      else if (key === "i" && permissions.edit) run("invalid", [current.id]);
      else if (key === "arrowright") setSkipped((previous) => new Set([...previous, current.id]));
      else if (key === "z") undoLast();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewing, current, permissions, run, undoLast]);

  function bringPhotos() {
    setPhotoProgress(0);
    startTransition(async () => {
      let afterId = "";
      let imported = 0;
      for (;;) {
        const result = await importLegacyPhotosAction({ afterId });
        if (!result.ok || !result.data) {
          toast(result.ok ? "Não foi possível trazer as fotos." : result.error, { tone: "error" });
          break;
        }
        imported += result.data.imported;
        setPhotoProgress(imported);
        if (!result.data.remaining) {
          toast(result.message);
          break;
        }
        afterId = result.data.lastId;
      }
      setPhotoProgress(null);
      router.refresh();
    });
  }

  const fields = (item: CurationItem, large = false) => (
    <>
      <InlineField
        label={`Nome de ${item.name}`}
        value={item.name}
        multiline
        disabled={!permissions.edit}
        className={large ? "text-lg font-semibold" : "text-sm font-medium"}
        onSave={(name) => save(renameProductAction({ id: item.id, name }))}
      />
      {item.variantCount === 1 ? (
        <InlineField
          label={`Preço de ${item.name}`}
          value={item.price}
          prefix="R$"
          inputMode="decimal"
          disabled={!permissions.price}
          className={large ? "text-lg" : "text-sm"}
          onSave={(price) => save(setProductPriceAction({ id: item.id, price }))}
        />
      ) : (
        <p className="px-1.5 text-sm text-muted-foreground">
          {item.variantCount === 0 ? (
            "Sem preço"
          ) : (
            <>
              A partir de {formatBRL(item.priceCents)}, em {item.variantCount} tamanhos.{" "}
              <Link href={`/admin/produtos/${item.id}`} className="underline underline-offset-2">
                Editar preços
              </Link>
            </>
          )}
        </p>
      )}
      <select
        aria-label={`Categoria de ${item.name}`}
        className={cn(selectClass, "h-8")}
        value={item.categoryId}
        disabled={!permissions.edit}
        onChange={(event) => {
          if (event.target.value)
            void save(
              setProductsCategoryAction({ ids: [item.id], categoryId: event.target.value }),
            );
        }}
      >
        <option value="">Sem categoria</option>
        {categories.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
      <CarrierToggle
        name={item.name}
        value={item.noCorreios}
        disabled={!permissions.edit}
        onSave={(noCorreios) => save(setProductsCarrierAction({ ids: [item.id], noCorreios }))}
      />
    </>
  );

  const badges = (item: CurationItem) => (
    <div className="flex flex-wrap gap-1 px-1.5">
      {item.featured ? <Badge>Destaque</Badge> : null}
      {tab !== "revisar" && tab !== "excluidos" ? (
        <Badge variant={item.published ? "secondary" : "outline"}>
          {item.published
            ? "Na loja"
            : item.imageCount === 0
              ? "Fora da loja: falta foto"
              : item.imageIsLegacy
                ? "Fora da loja: foto a trazer"
                : "Fora da loja"}
        </Badge>
      ) : null}
      {item.localOnly ? <Badge variant="outline">Só São Paulo</Badge> : null}
    </div>
  );

  const empty =
    visible.length === 0 ? (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">
          {tab === "revisar"
            ? total > 0 || hasMore
              ? "Tudo decidido nesta página."
              : "Nenhum produto esperando revisão."
            : tab === "excluidos"
              ? "Nenhum produto excluído."
              : "Nenhum produto aqui ainda."}
        </p>
        {hasMore ? (
          <Button className="mt-3" onClick={() => router.refresh()}>
            Carregar os próximos
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4 pb-24">
      {empty}
      <div className={cn("flex flex-wrap items-center gap-2", empty && "hidden")}>
        {tab === "revisar" ? (
          <Button onClick={() => setReviewing(true)}>Revisar um por um</Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() =>
            setSelected(
              chosen.length === visible.length
                ? new Set()
                : new Set(visible.map((item) => item.id)),
            )
          }
        >
          {chosen.length === visible.length ? "Limpar seleção" : "Selecionar todos desta página"}
        </Button>
        {tab !== "excluidos" && tab !== "revisar" && photosPending > 0 && permissions.images ? (
          <Button variant="outline" onClick={bringPhotos} disabled={photoProgress !== null}>
            {photoProgress === null
              ? `Trazer fotos do site antigo (${photosPending} produtos)`
              : `Trazendo fotos: ${photoProgress}`}
          </Button>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {visible.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <li
              key={item.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border bg-card",
                isSelected && "border-primary ring-2 ring-primary/30",
              )}
            >
              <div className="relative">
                <Photo item={item} className="aspect-square w-full" />
                <label className="absolute top-2 left-2 flex size-8 cursor-pointer items-center justify-center rounded-md bg-background/90 shadow-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={isSelected}
                    onChange={() =>
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                  />
                  <span className="sr-only">Selecionar {item.name}</span>
                </label>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {tab === "excluidos" ? (
                  <>
                    <p className="px-1.5 text-sm font-medium">{item.name}</p>
                    <p className="px-1.5 text-sm text-muted-foreground">
                      {item.variantCount ? formatBRL(item.priceCents) : "Sem preço"}
                      {item.categoryName ? `, em ${item.categoryName}` : ""}
                    </p>
                    <p className="px-1.5 text-xs text-muted-foreground">
                      Excluído em{" "}
                      {item.deletedAt ? deletedFormat.format(new Date(item.deletedAt)) : ""}
                      {item.deletedBy ? ` por ${item.deletedBy}` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    {fields(item)}
                    {badges(item)}
                  </>
                )}
                <div className="mt-auto flex gap-1.5 pt-1">
                  {tab === "excluidos" ? (
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!permissions.remove}
                      onClick={() => run("restore", [item.id])}
                    >
                      <RotateCcw aria-hidden />
                      Restaurar<span className="sr-only"> {item.name}</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={!permissions.remove}
                        aria-label={`Excluir ${item.name}`}
                        title="Excluir"
                        onClick={() => run("trash", [item.id])}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                      {tab !== "invalidos" ? (
                        <Button
                          size="icon-sm"
                          variant="outline"
                          disabled={!permissions.edit}
                          aria-label={`Marcar ${item.name} como inválido`}
                          title="Produto inválido"
                          onClick={() => run("invalid", [item.id])}
                        >
                          <Ban aria-hidden />
                        </Button>
                      ) : null}
                      <Button
                        size="icon-sm"
                        variant={item.featured ? "default" : "outline"}
                        disabled={!permissions.edit}
                        aria-pressed={item.featured}
                        aria-label={`${item.featured ? "Tirar dos destaques" : "Destacar"} ${item.name}`}
                        title={item.featured ? "Tirar dos destaques" : "Manter com destaque"}
                        onClick={() => run(item.featured ? "unfeature" : "feature", [item.id])}
                      >
                        <Star aria-hidden />
                      </Button>
                      {tab === "revisar" || tab === "invalidos" ? (
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!permissions.edit}
                          onClick={() => run("keep", [item.id])}
                        >
                          <Check aria-hidden />
                          Manter<span className="sr-only"> {item.name}</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={!permissions.edit}
                          onClick={() => run("pending", [item.id])}
                        >
                          Rever<span className="sr-only"> {item.name}</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {chosen.length > 0 ? (
        <div
          role="region"
          aria-label="Ações para os produtos selecionados"
          className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-lg border bg-background p-3 shadow-lg"
        >
          <p className="mr-auto text-sm font-medium" aria-live="polite">
            {chosen.length} {chosen.length === 1 ? "selecionado" : "selecionados"}
          </p>
          {tab === "excluidos" ? (
            <Button size="sm" disabled={!permissions.remove} onClick={() => run("restore", chosen)}>
              Restaurar
            </Button>
          ) : (
            <>
              {permissions.edit ? (
                <span className="flex items-center gap-1.5">
                  <select
                    aria-label="Mover os selecionados para a categoria"
                    className={cn(selectClass, "h-8 w-44")}
                    value={bulkCategory}
                    onChange={(event) => setBulkCategory(event.target.value)}
                  >
                    <option value="">Mover para...</option>
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!bulkCategory}
                    onClick={async () => {
                      if (
                        await save(
                          setProductsCategoryAction({ ids: chosen, categoryId: bulkCategory }),
                        )
                      ) {
                        setSelected(new Set());
                        setBulkCategory("");
                      }
                    }}
                  >
                    Mover
                  </Button>
                </span>
              ) : null}
              {permissions.edit ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (await save(setProductsCarrierAction({ ids: chosen, noCorreios: true })))
                      setSelected(new Set());
                  }}
                >
                  Sem Correios
                </Button>
              ) : null}
              {tab !== "invalidos" && permissions.edit ? (
                <Button size="sm" variant="outline" onClick={() => run("invalid", chosen)}>
                  Inválido
                </Button>
              ) : null}
              {(tab === "revisar" || tab === "invalidos") && permissions.edit ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => run("feature", chosen)}>
                    Destacar
                  </Button>
                  <Button size="sm" onClick={() => run("keep", chosen)}>
                    Manter
                  </Button>
                </>
              ) : null}
              {permissions.remove ? (
                <Button size="sm" variant="destructive" onClick={() => run("trash", chosen)}>
                  Excluir
                </Button>
              ) : null}
            </>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Limpar seleção"
            onClick={() => setSelected(new Set())}
          >
            <CloseIcon aria-hidden />
          </Button>
        </div>
      ) : null}

      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent
          className="max-h-[95dvh] overflow-y-auto sm:max-w-2xl"
          // O foco fica na janela, não no campo do nome, para os atalhos valerem de imediato.
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Revisar um por um</DialogTitle>
            <DialogDescription>
              {total} {total === 1 ? "produto espera" : "produtos esperam"} a sua decisão. No
              teclado: M mantém, D destaca, I marca como inválido, X exclui, seta para a direita
              pula e Z desfaz.
            </DialogDescription>
          </DialogHeader>
          {current ? (
            <div key={current.id} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Photo item={current} className="aspect-square w-full rounded-md" />
                <div className="flex flex-col gap-2">
                  {fields(current, true)}
                  {badges(current)}
                  <p className="px-1.5 text-xs text-muted-foreground">Código {current.sku}</p>
                  {current.description ? (
                    <p className="px-1.5 text-sm text-muted-foreground">{current.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="sticky bottom-0 -mx-1 grid grid-cols-2 gap-2 bg-background px-1 py-2 sm:grid-cols-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 text-destructive hover:text-destructive"
                  disabled={!permissions.remove}
                  onClick={() => run("trash", [current.id])}
                >
                  <Trash2 aria-hidden />
                  Excluir
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14"
                  disabled={!permissions.edit}
                  onClick={() => run("invalid", [current.id])}
                >
                  <Ban aria-hidden />
                  Inválido
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14"
                  disabled={!permissions.edit}
                  onClick={() => run("feature", [current.id])}
                >
                  <Star aria-hidden />
                  Destaque
                </Button>
                <Button
                  size="lg"
                  className="h-14"
                  disabled={!permissions.edit}
                  onClick={() => run("keep", [current.id])}
                >
                  <Check aria-hidden />
                  Manter
                </Button>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={undoLast}>
                  <Undo2 aria-hidden />
                  Desfazer a última
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSkipped((previous) => new Set([...previous, current.id]))}
                >
                  Decidir depois
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p>Você passou por todos os produtos desta lista.</p>
              <Button
                onClick={() => {
                  setSkipped(new Set());
                  setReviewing(false);
                  router.refresh();
                }}
              >
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
