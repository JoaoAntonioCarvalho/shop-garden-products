import { Leaf, PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BotanicalCaption, BotanicalSheet } from "@/components/store/botanical-sheet";
import { CategoryTile } from "@/components/store/category-tile";
import { FreeShippingProgress } from "@/components/store/free-shipping-progress";
import { Logo } from "@/components/store/logo";
import { ProductGrid, type ProductCardData } from "@/components/store/product-card";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { Tabs } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/toast";
import { storeConfig } from "@/config/store.config";
import { allowedTextPairs, colors, contrastRatio } from "@/lib/color";
import { getPriceDisplay } from "@/server/services/pricing";
import { CommerceDemo, FormDemo, OverlayDemo } from "./demos";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <h2 className="mb-8 type-h2 text-moss-900">{title}</h2>
      {children}
    </section>
  );
}

const regular = getPriceDisplay({ priceCents: 24900 }, storeConfig);
const promo = getPriceDisplay(
  { priceCents: 18900, compareAtPriceCents: 22900, promoPriceCents: 15900 },
  storeConfig,
);
const cheap = getPriceDisplay({ priceCents: 2900 }, storeConfig);

const sampleProducts: ProductCardData[] = [
  {
    id: "1",
    slug: "orquidea-phalaenopsis-branca-2-hastes",
    name: "Orquídea Phalaenopsis branca 2 hastes",
    sku: "TESTE-0001",
    scientificName: "Phalaenopsis amabilis",
    image: null,
    price: regular,
    ratingAverage: 4.8,
    ratingCount: 23,
    badges: ["sameDay", "new"],
    quickAddVariantId: "v1",
    hasOptions: false,
    soldOut: false,
  },
  {
    id: "2",
    slug: "vaso-de-ceramica-vitrificada-verde-musgo",
    name: "Vaso de cerâmica vitrificada verde-musgo",
    sku: "TESTE-0002",
    image: null,
    price: promo,
    ratingAverage: 4.5,
    ratingCount: 8,
    badges: ["sale", "lowStock", "new"],
    quickAddVariantId: null,
    hasOptions: true,
    soldOut: false,
    wishlisted: true,
  },
  {
    id: "3",
    slug: "zamioculca",
    name: "Zamioculca",
    sku: "TESTE-0003",
    scientificName: "Zamioculcas zamiifolia",
    image: null,
    price: regular,
    ratingAverage: 0,
    ratingCount: 0,
    badges: ["soldOut", "sameDay"],
    quickAddVariantId: null,
    hasOptions: false,
    soldOut: true,
  },
  {
    id: "4",
    slug: "manjericao",
    name: "Manjericão em vaso",
    sku: "TESTE-0004",
    scientificName: "Ocimum basilicum",
    image: null,
    price: cheap,
    ratingAverage: 5,
    ratingCount: 2,
    badges: [],
    quickAddVariantId: "v4",
    hasOptions: false,
    soldOut: false,
  },
];

export default function DesignSystemPage() {
  // Página interna: não existe em produção.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="container-store py-12">
      <Logo name={storeConfig.name} />
      <h1 className="mt-6 type-h1 text-moss-900">Design system</h1>
      <p className="mt-3 measure type-body-lg text-ink-muted">
        Todos os componentes da loja, com seus estados. Um único conjunto de tokens, definido em
        globals.css.
      </p>

      <Section title="Cores">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          {Object.entries(colors).map(([name, hex]) => (
            <li key={name}>
              <div className="h-16 rounded-photo border border-line" style={{ background: hex }} />
              <p className="mt-1.5 type-caption font-medium">{name}</p>
              <p className="type-caption text-ink-muted">{hex}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-10 mb-4 type-h3 text-moss-900">Combinações permitidas e contraste</h3>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {allowedTextPairs.map((pair) => (
            <li
              key={`${pair.text}-${pair.background}`}
              className="flex items-center justify-between rounded-photo border border-line px-3 py-2 type-small"
              style={{ color: colors[pair.text], background: colors[pair.background] }}
            >
              <span>
                {pair.text} sobre {pair.background}
              </span>
              <span className="tabular-nums">
                {contrastRatio(colors[pair.text], colors[pair.background]).toFixed(1)}:1
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tipografia">
        <div className="flex flex-col gap-5">
          <p className="type-display text-moss-900">Display: plantas escolhidas a dedo</p>
          <p className="type-h1 text-moss-900">Título 1: orquídeas</p>
          <p className="type-h2 text-moss-900">Título 2: mais vendidos</p>
          <p className="type-h3 text-moss-900">Título 3: cuidados com a planta</p>
          <p className="type-scientific text-[22px] text-moss-700">Phalaenopsis amabilis</p>
          <p className="measure type-body-lg">
            Corpo grande. Cada planta e cada peça passa pela curadoria de quem trabalha com isso há
            mais de duas décadas.
          </p>
          <p className="measure type-body">
            Corpo. Regue a cada 5 a 7 dias, quando o substrato estiver seco, e mantenha em luz
            indireta.
          </p>
          <p className="type-small text-ink-muted">
            Pequeno: texto de apoio e rótulos de formulário.
          </p>
          <p className="type-caption text-ink-muted">Legenda: código do produto e notas.</p>
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-col gap-5">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <Button size={size}>Adicionar à sacola</Button>
              <Button size={size} variant="secondary">
                Comprar agora
              </Button>
              <Button size={size} variant="ghost">
                Continuar comprando
              </Button>
              <WhatsAppButton
                size={size}
                number={storeConfig.whatsapp}
                message="Olá! Vim pelo site e gostaria de ajuda."
                position="pagina"
              >
                Tirar dúvida
              </WhatsAppButton>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button loading>Fazer pedido</Button>
            <Button variant="secondary" loading>
              Calcular frete
            </Button>
            <Button disabled>Desabilitado</Button>
            <Button variant="secondary" disabled>
              Desabilitado
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Formulários">
        <FormDemo />
      </Section>

      <Section title="Preço, selos e avaliação">
        <div className="grid gap-10 md:grid-cols-3">
          <Price price={regular} size="product" />
          <Price price={promo} size="product" />
          <div className="flex flex-col gap-4">
            <Price price={promo} size="card" />
            <Price price={promo} size="line" />
            <Price price={cheap} size="product" />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <Badge kind="new" />
          <Badge kind="sale" percent={15} />
          <Badge kind="sameDay" />
          <Badge kind="lowStock" />
          <Badge kind="soldOut" />
          <Badge kind="verified" />
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <Rating value={4.5} count={128} showValue size="md" />
          <Rating value={3} count={1} />
          <Rating value={5} />
        </div>
      </Section>

      <Section title="Navegação">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Plantas naturais", href: "/categoria/plantas-naturais" },
            { label: "Orquídeas" },
          ]}
        />
        <Pagination
          page={4}
          totalPages={12}
          hrefFor={(page) => `?pagina=${page}`}
          className="mt-8"
        />
        <Tabs
          className="mt-8"
          label="Informações do produto"
          items={[
            { id: "descricao", label: "Descrição", content: <p>Texto da descrição do produto.</p> },
            { id: "cuidados", label: "Cuidados", content: <p>Como cuidar da planta em casa.</p> },
            {
              id: "entrega",
              label: "Entrega e embalagem",
              content: <p>{storeConfig.packagingText}</p>,
            },
          ]}
        />
        <Accordion
          className="mt-8 max-w-2xl"
          defaultOpen={["sol"]}
          items={[
            {
              id: "sol",
              title: "Orquídea precisa de sol direto?",
              content: <p>Não. Ela prefere luz indireta, perto de uma janela bem iluminada.</p>,
            },
            {
              id: "cachepot",
              title: "Qual a diferença entre vaso e cachepot?",
              content: (
                <p>O vaso tem furo de drenagem. O cachepot é decorativo e recebe o vaso dentro.</p>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Modal, gaveta, aviso e dica">
        <OverlayDemo />
      </Section>

      <Section title="Alertas, carregamento e estado vazio">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info">Plantas vivas são entregues apenas na Grande São Paulo.</Alert>
          <Alert tone="success" title="Pagamento aprovado">
            Já estamos preparando o seu pedido.
          </Alert>
          <Alert tone="warning" title="Últimas 2 unidades" />
          <Alert tone="error" title="Este cupom expirou em 10/09/2026." />
        </div>
        <div className="mt-8 grid max-w-md grid-cols-2 gap-4">
          <div>
            <Skeleton className="aspect-4/5" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
          <div>
            <Skeleton className="aspect-4/5" />
            <Skeleton className="mt-3 h-4 w-3/5" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        </div>
        <EmptyState
          className="mt-8 border border-line"
          icon={<PackageOpen aria-hidden="true" strokeWidth={1.5} />}
          headingLevel="h3"
          title="Você ainda não tem favoritos"
          description="Toque no coração dos produtos para guardá-los aqui."
          action={<Button variant="secondary">Ver mais vendidos</Button>}
        />
      </Section>

      <Section title="Ficha botânica">
        <div className="grid gap-8 lg:grid-cols-2">
          <BotanicalSheet
            heading="Ficha botânica"
            title="Orquídea borboleta"
            scientificName="Phalaenopsis amabilis"
            sku="TESTE-0001"
            headingLevel="h3"
            rows={[
              { label: "Luz", value: "Luz indireta" },
              { label: "Rega", value: "A cada 5 a 7 dias, quando o substrato estiver seco" },
              { label: "Porte na entrega", value: "Cerca de 55 cm" },
              { label: "Ambiente", value: "Interno" },
              { label: "Pets", value: "Segura para pets" },
              { label: "Nível de cuidado", value: "Fácil" },
            ]}
          />
          <BotanicalSheet
            heading="Ficha técnica"
            title="Vaso de cerâmica vitrificada"
            sku="TESTE-0002"
            headingLevel="h3"
            rows={[
              { label: "Material", value: "Cerâmica vitrificada" },
              { label: "Dimensões", value: "28 × 30 × 18 cm (altura × boca × base)" },
              { label: "Capacidade", value: "12 litros" },
              { label: "Furo de drenagem", value: "Sim" },
              { label: "Uso", value: "Interno e externo" },
              { label: "Peso", value: "3,2 kg" },
            ]}
          />
          <BotanicalSheet
            heading="Ficha botânica"
            title="Lírio-da-paz"
            scientificName="Spathiphyllum wallisii"
            sku="TESTE-0005"
            headingLevel="h3"
            rows={[
              { label: "Luz", value: "Meia-sombra" },
              { label: "Pets", value: "Tóxico para pets", alert: true },
            ]}
          />
          <div className="flex items-start gap-3">
            <Leaf aria-hidden="true" strokeWidth={1.5} className="mt-1 size-5 text-moss-700" />
            <BotanicalCaption
              commonName="Orquídea borboleta"
              scientificName="Phalaenopsis amabilis"
            />
          </div>
        </div>
      </Section>

      <Section title="Produtos e categorias">
        <ProductGrid products={sampleProducts} />
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          <CategoryTile
            name="Orquídeas"
            href="/categoria/plantas-naturais/orquideas"
            image={null}
          />
          <CategoryTile name="Vasos" href="/categoria/vasos" image={null} />
          <CategoryTile name="Cachepots" href="/categoria/cachepots" image={null} />
          <CategoryTile
            name="Flores e plantas artificiais"
            href="/categoria/flores-e-plantas-artificiais"
            image={null}
          />
        </div>
      </Section>

      <Section title="Frete, cupom e newsletter">
        <div className="mb-10 grid max-w-xl gap-6">
          <FreeShippingProgress
            subtotalCents={25390}
            thresholdCents={storeConfig.freeShippingThresholdCents}
          />
          <FreeShippingProgress
            subtotalCents={34000}
            thresholdCents={storeConfig.freeShippingThresholdCents}
          />
        </div>
        <CommerceDemo
          storeName={storeConfig.name}
          discountPercent={storeConfig.welcomeCouponPercent}
        />
      </Section>

      <Toaster />
    </main>
  );
}
