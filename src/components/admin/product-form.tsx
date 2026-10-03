"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  FieldControl,
  SeoPreview,
  selectClass,
  useUnsavedWarning,
  type FieldDef,
  type FieldOption,
  type FormValues,
} from "@/components/admin/entity-form";
import { ImageUploader, MediaLibraryDialog } from "@/components/admin/media-picker";
import { SearchPicker } from "@/components/admin/search-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { BotanicalSheet } from "@/components/store/botanical-sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { productQuality, QUALITY_PUBLISH_MINIMUM } from "@/lib/product-quality";
import { buildProductSheet } from "@/lib/product-sheet";
import { slugify } from "@/lib/slug";
import {
  saveProductAction,
  saveProductImagesAction,
  searchProductsAction,
} from "@/server/actions/admin/products";

export type VariantRow = {
  key: string;
  id: string | null;
  name: string;
  sku: string;
  options: Record<string, string>;
  priceCents: string;
  compareAtPriceCents: string;
  costCents: string;
  promoPriceCents: string;
  promoStartsAt: string;
  promoEndsAt: string;
  weightGrams: string;
  stockOnHand: string;
  lowStockThreshold: string;
  barcode: string;
  isActive: boolean;
};
export type ImageRow = {
  mediaId: string;
  url: string;
  alt: string;
  isCover: boolean;
  variantSku: string;
};

export type ProductFormData = {
  id: string | null;
  wasPublished: boolean;
  values: FormValues;
  variants: VariantRow[];
  images: ImageRow[];
  related: Array<{ id: string; name: string }>;
};

type Props = {
  data: ProductFormData;
  categories: FieldOption[];
  collections: FieldOption[];
  deliveryAreas: FieldOption[];
  typeOptions: FieldOption[];
  canEdit: boolean;
  canEditImages: boolean;
  canSeeCost: boolean;
  storeUrl: string;
  history?: ReactNode;
};

const yesNo: FieldOption[] = [
  { value: "", label: "Não informado" },
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];
const blank = (options: FieldOption[]): FieldOption[] => [
  { value: "", label: "Não informado" },
  ...options,
];

const SHEET_FIELDS: FieldDef[] = [
  { name: "commonName", label: "Nome popular", type: "text", section: "Ficha botânica" },
  { name: "scientificName", label: "Nome científico", type: "text", section: "Ficha botânica" },
  {
    name: "light",
    label: "Luz",
    type: "select",
    section: "Ficha botânica",
    options: blank([
      { value: "FULL_SUN", label: "Sol pleno" },
      { value: "PARTIAL_SHADE", label: "Meia-sombra" },
      { value: "SHADE", label: "Sombra" },
      { value: "INDIRECT_LIGHT", label: "Luz indireta" },
    ]),
  },
  {
    name: "watering",
    label: "Rega",
    type: "text",
    section: "Ficha botânica",
    placeholder: "Por exemplo: uma vez por semana",
  },
  {
    name: "environment",
    label: "Ambiente",
    type: "select",
    section: "Ficha botânica",
    options: blank([
      { value: "INDOOR", label: "Interno" },
      { value: "OUTDOOR", label: "Externo" },
      { value: "BOTH", label: "Interno e externo" },
    ]),
  },
  {
    name: "petSafety",
    label: "Pets",
    type: "select",
    section: "Ficha botânica",
    options: blank([
      { value: "SAFE", label: "Pet friendly" },
      { value: "NOT_SAFE", label: "Não indicada para casas com pets" },
      { value: "TOXIC", label: "Tóxica para pets" },
    ]),
  },
  {
    name: "careLevel",
    label: "Nível de cuidado",
    type: "select",
    section: "Ficha botânica",
    options: blank([
      { value: "EASY", label: "Fácil" },
      { value: "MODERATE", label: "Moderado" },
      { value: "DEMANDING", label: "Exige atenção" },
    ]),
  },
  { name: "heightCm", label: "Altura (cm)", type: "text", section: "Dimensões" },
  { name: "widthCm", label: "Largura (cm)", type: "text", section: "Dimensões" },
  { name: "depthCm", label: "Profundidade (cm)", type: "text", section: "Dimensões" },
  { name: "mouthDiameterCm", label: "Diâmetro da boca (cm)", type: "text", section: "Dimensões" },
  { name: "baseDiameterCm", label: "Diâmetro da base (cm)", type: "text", section: "Dimensões" },
  { name: "capacityLiters", label: "Capacidade (litros)", type: "text", section: "Dimensões" },
  { name: "material", label: "Material", type: "text", section: "Ficha técnica" },
  { name: "color", label: "Cor", type: "text", section: "Ficha técnica" },
  {
    name: "hasDrainageHole",
    label: "Tem furo de drenagem",
    type: "select",
    section: "Ficha técnica",
    options: yesNo,
  },
  {
    name: "indoorOutdoor",
    label: "Uso",
    type: "select",
    section: "Ficha técnica",
    options: blank([
      { value: "INDOOR", label: "Interno" },
      { value: "OUTDOOR", label: "Externo" },
      { value: "BOTH", label: "Interno e externo" },
    ]),
  },
  {
    name: "includesPot",
    label: "Acompanha vaso (artificiais)",
    type: "select",
    section: "Ficha técnica",
    options: yesNo,
  },
  { name: "subtype", label: "Subtipo (usado nos filtros)", type: "text", section: "Ficha técnica" },
  {
    name: "cleaningCare",
    label: "Limpeza e conservação",
    type: "textarea",
    section: "Ficha técnica",
    wide: true,
  },
];

const DELIVERY_FIELDS: FieldDef[] = [
  { name: "sameDayEligible", label: "Pode ser entregue hoje (Grande São Paulo)", type: "checkbox" },
  {
    name: "deliveryScope",
    label: "Onde entrega",
    type: "select",
    options: [
      { value: "NATIONAL", label: "Todo o Brasil" },
      { value: "LOCAL_ONLY", label: "Só na Grande São Paulo" },
    ],
  },
  {
    name: "carrierRestriction",
    label: "Transportadora no envio nacional",
    type: "select",
    options: [
      { value: "ANY", label: "Qualquer uma (a mais barata)" },
      { value: "JADLOG_ONLY", label: "Só Jadlog (volumoso ou planta que os Correios não aceitam)" },
    ],
    help: "Com um produto só Jadlog na sacola, o pedido inteiro vai pela Jadlog.",
  },
  { name: "fragile", label: "Frágil", type: "checkbox" },
  { name: "perishable", label: "Perecível (planta ou flor natural)", type: "checkbox" },
];

const SHEET_NAMES = new Set(SHEET_FIELDS.map((field) => field.name));
const DELIVERY_NAMES = new Set(DELIVERY_FIELDS.map((field) => field.name));

function tabOfError(key: string): string {
  if (key.startsWith("variants")) return "variacoes";
  if (key.startsWith("images")) return "imagens";
  if (key.startsWith("seo")) return "seo";
  if (key.startsWith("related")) return "relacionados";
  if (SHEET_NAMES.has(key)) return "ficha";
  if (DELIVERY_NAMES.has(key)) return "entrega";
  return "geral";
}

const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return String(value ?? "").trim() !== "" && Number.isFinite(parsed) ? parsed : null;
};
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

let variantKey = 0;
const newKey = () => `nova-${++variantKey}`;

export function ProductForm({
  data,
  categories,
  collections,
  deliveryAreas,
  typeOptions,
  canEdit,
  canEditImages,
  canSeeCost,
  storeUrl,
  history,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(data.values);
  const [variants, setVariants] = useState<VariantRow[]>(data.variants);
  const [images, setImages] = useState<ImageRow[]>(data.images);
  const [related, setRelated] = useState(data.related);
  const [options, setOptions] = useState<Array<{ name: string; values: string }>>(() => {
    const collected = new Map<string, Set<string>>();
    for (const variant of data.variants)
      for (const [name, value] of Object.entries(variant.options))
        collected.set(name, (collected.get(name) ?? new Set()).add(value));
    return [...collected].map(([name, set]) => ({ name, values: [...set].join(", ") }));
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(data.id));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmScore, setConfirmScore] = useState<number | null>(null);
  const [library, setLibrary] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [tab, setTab] = useState(canEdit ? "geral" : "imagens");
  const [pending, startTransition] = useTransition();
  useUnsavedWarning(dirty);

  const touch = () => setDirty(true);
  const set = (name: string, value: unknown) => {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "name" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    if (name === "slug") setSlugTouched(true);
    touch();
  };
  const field = (definition: FieldDef) => (
    <FieldControl
      key={definition.name}
      field={{ ...definition, disabled: !canEdit }}
      value={values[definition.name]}
      error={errors[definition.name]}
      onChange={(value) => set(definition.name, value)}
    />
  );

  const generalFields: FieldDef[] = [
    { name: "name", label: "Nome", type: "text", maxLength: 160, wide: true },
    {
      name: "slug",
      label: "Endereço (slug)",
      type: "text",
      help:
        data.wasPublished && values.slug !== data.values.slug
          ? "O endereço antigo vai redirecionar para o novo automaticamente."
          : `${storeUrl}/produto/${String(values.slug ?? "")}`,
    },
    { name: "sku", label: "Código do produto (SKU pai)", type: "text" },
    { name: "productType", label: "Tipo", type: "select", options: typeOptions },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "DRAFT", label: "Rascunho" },
        { value: "ACTIVE", label: "Publicado" },
        { value: "ARCHIVED", label: "Arquivado" },
      ],
    },
    {
      name: "primaryCategoryId",
      label: "Categoria principal",
      type: "select",
      options: [{ value: "", label: "Sem categoria" }, ...categories],
    },
    { name: "brand", label: "Marca", type: "text" },
    {
      name: "additionalCategoryIds",
      label: "Outras categorias",
      type: "checklist",
      options: categories,
    },
    { name: "collectionIds", label: "Coleções", type: "checklist", options: collections },
    { name: "tags", label: "Tags (ocasiões, estilo, cor)", type: "tags", wide: true },
    {
      name: "shortDescription",
      label: "Descrição curta",
      type: "textarea",
      rows: 2,
      maxLength: 160,
      counter: true,
      wide: true,
    },
    { name: "description", label: "Descrição", type: "richtext" },
    { name: "careInstructions", label: "Cuidados", type: "richtext" },
    { name: "isFeatured", label: "Destaque", type: "checkbox" },
    { name: "isNew", label: "Novidade", type: "checkbox" },
    { name: "isGiftable", label: "Bom para presente", type: "checkbox" },
  ];

  const sheetSource = {
    name: String(values.name ?? ""),
    productType: String(values.productType ?? ""),
    commonName: str(values.commonName),
    scientificName: str(values.scientificName),
    light: str(values.light),
    watering: str(values.watering),
    environment: str(values.environment),
    petSafety: str(values.petSafety),
    careLevel: str(values.careLevel),
    heightCm: num(values.heightCm),
    material: str(values.material),
    color: str(values.color),
    widthCm: num(values.widthCm),
    depthCm: num(values.depthCm),
    mouthDiameterCm: num(values.mouthDiameterCm),
    baseDiameterCm: num(values.baseDiameterCm),
    capacityLiters: num(values.capacityLiters),
    hasDrainageHole: values.hasDrainageHole === "" ? null : values.hasDrainageHole === "true",
    indoorOutdoor: str(values.indoorOutdoor),
    includesPot: values.includesPot === "" ? null : values.includesPot === "true",
    cleaningCare: str(values.cleaningCare),
    brand: str(values.brand),
    weightGrams: num(variants[0]?.weightGrams),
  };
  const sheet = buildProductSheet(sheetSource);
  const quality = productQuality({
    ...sheetSource,
    primaryCategoryId: str(values.primaryCategoryId),
    shortDescription: str(values.shortDescription),
    descriptionText: String(values.description ?? "").replace(/<[^>]+>/g, " "),
    seoTitle: str(values.seoTitle),
    seoDescription: str(values.seoDescription),
    images,
    variantWeights: variants
      .filter((variant) => variant.isActive)
      .map((variant) => num(variant.weightGrams) ?? 0),
  });

  const updateVariant = (key: string, changes: Partial<VariantRow>) => {
    setVariants((current) =>
      current.map((variant) => (variant.key === key ? { ...variant, ...changes } : variant)),
    );
    touch();
  };
  const emptyVariant = (
    name: string,
    variantOptions: Record<string, string>,
    index: number,
  ): VariantRow => ({
    key: newKey(),
    id: null,
    name,
    sku: `${String(values.sku ?? "")}-${String(index + 1).padStart(2, "0")}`.replace(/^-/, ""),
    options: variantOptions,
    priceCents: variants[0]?.priceCents ?? "",
    compareAtPriceCents: "",
    costCents: variants[0]?.costCents ?? "",
    promoPriceCents: "",
    promoStartsAt: "",
    promoEndsAt: "",
    weightGrams: variants[0]?.weightGrams ?? "0",
    stockOnHand: "0",
    lowStockThreshold: variants[0]?.lowStockThreshold ?? "3",
    barcode: "",
    isActive: true,
  });

  /** Cria uma variação para cada combinação de opções que ainda não existe. */
  function generateCombinations() {
    const defined = options
      .map((option) => ({
        name: option.name.trim(),
        values: option.values
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }))
      .filter((option) => option.name && option.values.length);
    if (defined.length === 0) return;
    let combos: Array<Record<string, string>> = [{}];
    for (const option of defined)
      combos = combos.flatMap((combo) =>
        option.values.map((value) => ({ ...combo, [option.name]: value })),
      );
    setVariants((current) => {
      const kept = current.filter(
        (variant) => Object.keys(variant.options).length > 0 || current.length > 1 || variant.id,
      );
      const existing = new Set(kept.map((variant) => JSON.stringify(variant.options)));
      const created = combos
        .filter((combo) => !existing.has(JSON.stringify(combo)))
        .map((combo, index) =>
          emptyVariant(Object.values(combo).join(", "), combo, kept.length + index),
        );
      return [...kept, ...created];
    });
    touch();
  }

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    setImages((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    touch();
  };
  const addImage = (item: { id: string; thumb: string; alt: string }) => {
    setImages((current) =>
      current.some((image) => image.mediaId === item.id)
        ? current
        : [
            ...current,
            {
              mediaId: item.id,
              url: item.thumb,
              alt: item.alt,
              isCover: current.length === 0,
              variantSku: "",
            },
          ],
    );
    touch();
  };

  const imagePayload = () =>
    images.map((image) => ({
      mediaId: image.mediaId,
      alt: image.alt,
      isCover: image.isCover,
      variantSku: image.variantSku || null,
    }));

  function submit(confirmLowQuality = false) {
    startTransition(async () => {
      const result = canEdit
        ? await saveProductAction({
            ...values,
            id: data.id,
            variants: variants.map((variant) => ({ ...variant, key: undefined })),
            images: imagePayload(),
            relatedProductIds: related.map((item) => item.id),
            confirmLowQuality,
          })
        : await saveProductImagesAction({ id: data.id, images: imagePayload() });
      if (
        result.ok &&
        result.data &&
        "needsConfirmation" in result.data &&
        result.data.needsConfirmation
      ) {
        setConfirmScore(result.data.score ?? 0);
        return;
      }
      if (result.ok) {
        setErrors({});
        setFormError(null);
        setDirty(false);
        toast(result.message);
        const redirect =
          result.data && "redirect" in result.data ? result.data.redirect : undefined;
        if (redirect) router.push(redirect);
        else router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        const firstKey = Object.keys(result.fieldErrors ?? {})[0];
        if (firstKey) setTab(tabOfError(firstKey));
        window.scrollTo({ top: 0 });
      }
    });
  }

  const errorTabs = new Set(Object.keys(errors).map(tabOfError));
  const tabs: Array<[string, string]> = [
    ["geral", "Geral"],
    ["variacoes", "Variações"],
    ["imagens", "Imagens"],
    ["ficha", "Ficha"],
    ["entrega", "Entrega"],
    ["seo", "SEO"],
    ["relacionados", "Relacionados"],
    ...(history ? ([["historico", "Histórico"]] as Array<[string, string]>) : []),
  ];
  const cell = "h-8 min-w-24 px-2 text-sm";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-4 xl:grid-cols-[1fr_280px]"
    >
      <div className="min-w-0">
        {formError ? (
          <div
            role="alert"
            className="mb-3 rounded-md border border-destructive bg-wine-50 p-3 text-sm text-destructive"
          >
            <p>{formError}</p>
            {Object.keys(errors).length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {[...new Set(Object.values(errors))].map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap justify-start">
            {tabs.map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
                {errorTabs.has(value) ? (
                  <span className="text-destructive-foreground ml-1 rounded-xs bg-destructive px-1 text-xs">
                    erro
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="geral">
            <Card>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                {generalFields.map(field)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variacoes" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Opções</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Por exemplo: opção “Tamanho” com os valores “P, M, G”. Produto sem opções fica com
                  uma variação “Padrão”.
                </p>
                {options.map((option, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`opcao-nome-${index}`} className="text-xs">
                        Opção
                      </Label>
                      <Input
                        id={`opcao-nome-${index}`}
                        value={option.name}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setOptions((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                        className="w-40"
                      />
                    </div>
                    <div className="flex min-w-48 flex-1 flex-col gap-1">
                      <Label htmlFor={`opcao-valores-${index}`} className="text-xs">
                        Valores, separados por vírgula
                      </Label>
                      <Input
                        id={`opcao-valores-${index}`}
                        value={option.values}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setOptions((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, values: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover opção ${option.name}`}
                      disabled={!canEdit}
                      onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => setOptions((current) => [...current, { name: "", values: "" }])}
                  >
                    <Plus aria-hidden="true" />
                    Adicionar opção
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEdit || options.length === 0}
                    onClick={generateCombinations}
                  >
                    Gerar combinações
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Variações do produto">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        {[
                          "Nome",
                          "SKU",
                          "Preço (R$)",
                          "Preço de (R$)",
                          ...(canSeeCost ? ["Custo (R$)"] : []),
                          "Promoção (R$)",
                          "Início da promoção",
                          "Fim da promoção",
                          "Peso (g)",
                          "Estoque",
                          "Alerta",
                          "Código de barras",
                          "Ativa",
                          "",
                        ].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="px-1 pb-1 font-medium whitespace-nowrap"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant, index) => {
                        const input = (
                          name: keyof VariantRow,
                          label: string,
                          extra: {
                            type?: string;
                            mode?: "decimal" | "numeric";
                            className?: string;
                          } = {},
                        ) => (
                          <td className="p-1">
                            <Input
                              aria-label={`${label} da variação ${variant.name || index + 1}`}
                              aria-invalid={errors[`variants.${index}.${name}`] ? true : undefined}
                              type={extra.type ?? "text"}
                              inputMode={extra.mode}
                              value={String(variant[name] ?? "")}
                              disabled={!canEdit}
                              onChange={(event) =>
                                updateVariant(variant.key, { [name]: event.target.value })
                              }
                              className={cn(cell, extra.className)}
                            />
                          </td>
                        );
                        return (
                          <tr key={variant.key} className="border-t border-border">
                            {input("name", "Nome", { className: "min-w-40" })}
                            {input("sku", "SKU", { className: "min-w-36" })}
                            {input("priceCents", "Preço", { mode: "decimal" })}
                            {input("compareAtPriceCents", "Preço de", { mode: "decimal" })}
                            {canSeeCost ? input("costCents", "Custo", { mode: "decimal" }) : null}
                            {input("promoPriceCents", "Preço promocional", { mode: "decimal" })}
                            {input("promoStartsAt", "Início da promoção", {
                              type: "datetime-local",
                              className: "min-w-44",
                            })}
                            {input("promoEndsAt", "Fim da promoção", {
                              type: "datetime-local",
                              className: "min-w-44",
                            })}
                            {input("weightGrams", "Peso em gramas", {
                              mode: "numeric",
                              className: "min-w-20",
                            })}
                            {input("stockOnHand", "Estoque", {
                              mode: "numeric",
                              className: "min-w-20",
                            })}
                            {input("lowStockThreshold", "Alerta de estoque", {
                              mode: "numeric",
                              className: "min-w-16",
                            })}
                            {input("barcode", "Código de barras", { className: "min-w-32" })}
                            <td className="p-1 text-center">
                              <input
                                type="checkbox"
                                className="control-check size-4"
                                aria-label={`Variação ${variant.name} ativa`}
                                checked={variant.isActive}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateVariant(variant.key, { isActive: event.target.checked })
                                }
                              />
                            </td>
                            <td className="p-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remover variação ${variant.name}`}
                                disabled={!canEdit || variants.length === 1}
                                onClick={() => {
                                  setVariants((current) =>
                                    current.filter((item) => item.key !== variant.key),
                                  );
                                  touch();
                                }}
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={!canEdit}
                  onClick={() => {
                    setVariants((current) => [...current, emptyVariant("", {}, current.length)]);
                    touch();
                  }}
                >
                  <Plus aria-hidden="true" />
                  Adicionar variação
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Mudar o estoque aqui registra um ajuste de inventário no histórico. Variação já
                  vendida não é apagada: fica inativa.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imagens">
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                {canEditImages ? (
                  <>
                    <ImageUploader onUploaded={addImage} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => setLibrary(true)}
                    >
                      Escolher da biblioteca
                    </Button>
                    <MediaLibraryDialog
                      open={library}
                      onOpenChange={setLibrary}
                      onPick={addImage}
                    />
                  </>
                ) : null}
                {images.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma imagem. A primeira enviada vira a capa.
                  </p>
                ) : null}
                <ol className="flex flex-col gap-2">
                  {images.map((image, index) => (
                    <li
                      key={image.mediaId}
                      draggable={canEditImages}
                      onDragStart={() => setDragging(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragging !== null) moveImage(dragging, index);
                        setDragging(null);
                      }}
                      className={cn(
                        "flex flex-wrap items-center gap-3 rounded-md border border-border bg-background p-2",
                        dragging === index && "opacity-50",
                      )}
                    >
                      <GripVertical
                        aria-hidden="true"
                        className="size-4 cursor-grab text-muted-foreground"
                      />
                      <Image
                        src={image.url}
                        alt=""
                        width={64}
                        height={80}
                        unoptimized
                        className="h-20 w-16 rounded-sm object-cover"
                      />
                      <div className="flex min-w-48 flex-1 flex-col gap-1">
                        <Label htmlFor={`alt-${image.mediaId}`} className="text-xs">
                          Texto alternativo (obrigatório para publicar)
                        </Label>
                        <Input
                          id={`alt-${image.mediaId}`}
                          value={image.alt}
                          maxLength={200}
                          disabled={!canEditImages}
                          aria-invalid={!image.alt.trim() || undefined}
                          onChange={(event) => {
                            setImages((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, alt: event.target.value } : item,
                              ),
                            );
                            touch();
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`variante-${image.mediaId}`} className="text-xs">
                          Variação
                        </Label>
                        <select
                          id={`variante-${image.mediaId}`}
                          value={image.variantSku}
                          disabled={!canEditImages}
                          onChange={(event) => {
                            setImages((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, variantSku: event.target.value } : item,
                              ),
                            );
                            touch();
                          }}
                          className={cn(selectClass, "w-40")}
                        >
                          <option value="">Todas</option>
                          {variants.map((variant) => (
                            <option key={variant.key} value={variant.sku}>
                              {variant.name || variant.sku}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name="capa"
                          className="control-radio size-4"
                          checked={image.isCover}
                          disabled={!canEditImages}
                          onChange={() => {
                            setImages((current) =>
                              current.map((item, i) => ({ ...item, isCover: i === index })),
                            );
                            touch();
                          }}
                        />
                        Capa
                      </label>
                      <div className="flex">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Mover imagem ${index + 1} para cima`}
                          disabled={!canEditImages || index === 0}
                          onClick={() => moveImage(index, index - 1)}
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Mover imagem ${index + 1} para baixo`}
                          disabled={!canEditImages || index === images.length - 1}
                          onClick={() => moveImage(index, index + 1)}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover imagem ${index + 1}`}
                          disabled={!canEditImages}
                          onClick={() => {
                            setImages((current) => current.filter((_, i) => i !== index));
                            touch();
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ficha" className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-4">
              {["Ficha botânica", "Dimensões", "Ficha técnica"].map((section) => (
                <Card key={section}>
                  <CardHeader>
                    <CardTitle className="text-base">{section}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {SHEET_FIELDS.filter((item) => item.section === section).map(field)}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Prévia na loja</p>
              {sheet ? (
                <BotanicalSheet {...sheet} sku={String(values.sku ?? "")} headingLevel="h3" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preencha os campos para ver a ficha.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="entrega">
            <Card>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                {DELIVERY_FIELDS.map(field)}
                {field({
                  name: "deliveryAreaId",
                  label: "Área de entrega",
                  type: "select",
                  options: [{ value: "", label: "Sem área própria" }, ...deliveryAreas],
                  help: "Com uma área, o produto só é vendido para CEPs dentro dela, e o cliente de fora é avisado. As áreas ficam em Configurações, Áreas de entrega.",
                })}
                <p className="text-sm text-muted-foreground md:col-span-2">
                  O peso fica em cada variação, na aba Variações. Altura, largura e profundidade
                  ficam na aba Ficha e entram no cálculo do frete.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seo">
            <Card>
              <CardContent className="grid gap-4 pt-6">
                {field({
                  name: "seoTitle",
                  label: "Título para o Google",
                  type: "text",
                  maxLength: 60,
                  counter: true,
                  wide: true,
                })}
                {field({
                  name: "seoDescription",
                  label: "Descrição para o Google",
                  type: "textarea",
                  rows: 3,
                  maxLength: 155,
                  counter: true,
                  wide: true,
                })}
                <SeoPreview
                  url={`${storeUrl}/produto/${String(values.slug ?? "")}`}
                  title={String(values.seoTitle || values.name || "")}
                  description={String(values.seoDescription || values.shortDescription || "")}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relacionados">
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <p className="text-sm text-muted-foreground">
                  Produtos mostrados em “Combina com”. Sem escolha, a loja sugere produtos da mesma
                  categoria.
                </p>
                {canEdit ? (
                  <SearchPicker
                    id="buscar-relacionado"
                    label="Adicionar produto"
                    placeholder="Nome ou SKU"
                    search={searchProductsAction}
                    render={(hit) => `${hit.name}, ${hit.sku}`}
                    onPick={(hit) => {
                      if (hit.id !== data.id)
                        setRelated((current) =>
                          current.some((item) => item.id === hit.id)
                            ? current
                            : [...current, { id: hit.id, name: hit.name }].slice(0, 12),
                        );
                      touch();
                    }}
                  />
                ) : null}
                <ul className="flex flex-col gap-1">
                  {related.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-1 text-sm"
                    >
                      {item.name}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${item.name}`}
                        disabled={!canEdit}
                        onClick={() => {
                          setRelated((current) => current.filter((entry) => entry.id !== item.id));
                          touch();
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {history ? <TabsContent value="historico">{history}</TabsContent> : null}
        </Tabs>
      </div>

      <aside className="flex flex-col gap-4 self-start xl:sticky xl:top-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qualidade do cadastro</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-2xl font-semibold tabular-nums">
              {quality.score}
              <span className="text-sm font-normal text-muted-foreground"> de 100</span>
            </p>
            <progress
              value={quality.score}
              max={100}
              aria-label="Qualidade do cadastro"
              className="mt-1 h-2 w-full"
            />
            {quality.score < QUALITY_PUBLISH_MINIMUM ? (
              <p className="mt-1 text-xs text-warning">
                Abaixo de {QUALITY_PUBLISH_MINIMUM}: publicar pede confirmação.
              </p>
            ) : null}
            <ul className="mt-3 flex flex-col gap-1">
              {quality.checks.map((check) => (
                <li
                  key={check.key}
                  className={cn(
                    "flex gap-2",
                    check.ok ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span aria-hidden="true">{check.ok ? "✓" : "○"}</span>
                  <span>
                    {check.label}
                    <span className="sr-only">{check.ok ? ", feito" : ", falta"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            disabled={pending || (!canEdit && !canEditImages)}
            aria-busy={pending || undefined}
          >
            {canEdit ? "Salvar produto" : "Salvar imagens"}
          </Button>
          {dirty ? (
            <p className="text-center text-sm text-muted-foreground">Alterações não salvas</p>
          ) : null}
        </div>
      </aside>

      <AlertDialog
        open={confirmScore !== null}
        onOpenChange={(open) => !open && setConfirmScore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar com cadastro incompleto?</AlertDialogTitle>
            <AlertDialogDescription>
              A qualidade do cadastro de {String(values.name)} está em {confirmScore} de 100, abaixo
              de {QUALITY_PUBLISH_MINIMUM}. Produtos com fotos, descrição e ficha completas vendem
              mais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e completar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmScore(null);
                submit(true);
              }}
            >
              Publicar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
