import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import {
  EntityForm,
  MiniForm,
  type FieldDef,
  type FormValues,
} from "@/components/admin/entity-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { getEnv } from "@/lib/env";
import { formatCentsPlain } from "@/lib/money";
import { formatCep } from "@/lib/validators/cep";
import { saveSettingsAction, sendTestEmailAction } from "@/server/actions/admin/system";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Configurações" };

const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map(
  (label, index) => ({ value: String(index), label }),
);

const fields: FieldDef[] = [
  { name: "name", label: "Nome da loja", type: "text", section: "Dados da loja" },
  { name: "tagline", label: "Frase de apresentação", type: "text", section: "Dados da loja" },
  { name: "legalName", label: "Razão social", type: "text", section: "Dados da loja" },
  { name: "cnpj", label: "CNPJ", type: "text", section: "Dados da loja" },
  {
    name: "address",
    label: "Endereço completo",
    type: "text",
    section: "Dados da loja",
    wide: true,
  },
  {
    name: "whatsapp",
    label: "WhatsApp (com código do país e DDD)",
    type: "text",
    section: "Dados da loja",
    placeholder: "5511999999999",
  },
  {
    name: "phoneDisplay",
    label: "Telefone como aparece na loja",
    type: "text",
    section: "Dados da loja",
  },
  { name: "email", label: "E-mail de atendimento", type: "email", section: "Dados da loja" },
  {
    name: "businessHours",
    label: "Horário de atendimento",
    type: "text",
    section: "Dados da loja",
  },
  {
    name: "instagram",
    label: "Instagram (endereço completo)",
    type: "text",
    section: "Dados da loja",
  },
  {
    name: "partnerClaim",
    label: "Frase da parceria com o Shopping Garden",
    type: "text",
    section: "Dados da loja",
  },
  {
    name: "pixDiscountPercent",
    label: "Desconto no Pix (%)",
    type: "number",
    section: "Regras comerciais",
  },
  {
    name: "freeShippingThresholdCents",
    label: "Frete grátis a partir de (R$)",
    type: "money",
    section: "Regras comerciais",
  },
  {
    name: "maxInstallments",
    label: "Parcelas no cartão, sem juros",
    type: "number",
    section: "Regras comerciais",
  },
  {
    name: "minInstallmentCents",
    label: "Parcela mínima (R$)",
    type: "money",
    section: "Regras comerciais",
  },
  {
    name: "giftWrapPriceCents",
    label: "Embalagem para presente (R$)",
    type: "money",
    section: "Regras comerciais",
  },
  {
    name: "pixExpirationMinutes",
    label: "Validade do Pix (minutos)",
    type: "number",
    section: "Regras comerciais",
  },
  {
    name: "cartExpirationDays",
    label: "Validade da sacola (dias)",
    type: "number",
    section: "Regras comerciais",
  },
  {
    name: "lowStockDefaultThreshold",
    label: "Alerta de estoque baixo padrão",
    type: "number",
    section: "Regras comerciais",
  },
  {
    name: "welcomeCoupon",
    label: "Cupom de boas-vindas",
    type: "text",
    section: "Regras comerciais",
    help: "Entregue no pop-up e na newsletter. Precisa existir em Cupons.",
  },
  {
    name: "welcomeCouponPercent",
    label: "Percentual anunciado do cupom de boas-vindas",
    type: "number",
    section: "Regras comerciais",
  },
  {
    name: "sameDayEnabled",
    label: "Entrega hoje ligada",
    type: "checkbox",
    section: "Entrega hoje",
  },
  {
    name: "sameDayCutoff",
    label: "Horário de corte (HH:MM)",
    type: "text",
    section: "Entrega hoje",
  },
  {
    name: "sameDayDeliverBy",
    label: "Entrega até que hora",
    type: "number",
    section: "Entrega hoje",
  },
  {
    name: "sameDayDays",
    label: "Dias com entrega hoje",
    type: "checklist",
    options: weekdays,
    section: "Entrega hoje",
  },
  {
    name: "sameDayRanges",
    label: "Faixas de CEP atendidas (uma por linha)",
    type: "textarea",
    rows: 3,
    section: "Entrega hoje",
    wide: true,
    help: "Formato: 01000-000 a 05999-999.",
  },
  {
    name: "packagingText",
    label: "Texto de entrega e embalagem na página de produto",
    type: "textarea",
    rows: 3,
    section: "Entrega hoje",
    wide: true,
  },
  {
    name: "ga4Id",
    label: "ID do Google Analytics 4",
    type: "text",
    section: "Analytics",
    placeholder: "G-XXXXXXXXXX",
    help: "Os scripts só carregam depois que o visitante aceita os cookies de análise.",
  },
  { name: "metaPixelId", label: "ID do pixel da Meta", type: "text", section: "Analytics" },
  {
    name: "notificationEmail",
    label: "E-mail que recebe os avisos internos",
    type: "email",
    section: "E-mails",
    help: "Novo pedido, contato, solicitação e resumo de estoque baixo.",
  },
  {
    name: "maintenanceMode",
    label: "Modo manutenção: a loja mostra “Voltamos em breve”",
    type: "checkbox",
    section: "Manutenção",
    help: "O painel continua funcionando, e a equipe logada continua vendo a loja.",
  },
];

export default async function SettingsPage() {
  const user = await requireAdminPage("settings.manage");
  const settings = await getStoreSettings();
  const env = getEnv();
  const initial: FormValues = {
    ...settings,
    minInstallmentCents: formatCentsPlain(settings.minInstallmentCents),
    freeShippingThresholdCents: formatCentsPlain(settings.freeShippingThresholdCents),
    giftWrapPriceCents: formatCentsPlain(settings.giftWrapPriceCents),
    sameDayEnabled: settings.sameDay.enabled,
    sameDayCutoff: settings.sameDay.cutoffTime,
    sameDayDeliverBy: settings.sameDay.deliverByHour,
    sameDayDays: settings.sameDay.days.map(String),
    sameDayRanges: settings.sameDay.cepRanges
      .map((range) => `${formatCep(range.start)} a ${formatCep(range.end)}`)
      .join("\n"),
    ga4Id: settings.analytics.ga4Id,
    metaPixelId: settings.analytics.metaPixelId,
  };
  const sendTest = async (values: FormValues) => {
    "use server";
    return sendTestEmailAction({ to: String(values.to ?? "") });
  };
  const integrations: Array<[string, string, string]> = [
    [
      "Pagamentos",
      env.PAYMENT_PROVIDER === "mock" ? "Modo simulado" : env.PAYMENT_PROVIDER,
      "Pix, cartão e boleto simulados. Nenhum dinheiro é movimentado.",
    ],
    [
      "Cotação de frete",
      env.SHIPPING_PROVIDER === "mock" ? "Modo simulado" : env.SHIPPING_PROVIDER,
      "Calculada pelas regras de Frete e entrega, sem transportadora.",
    ],
    ["E-mail", `SMTP em ${env.SMTP_HOST}`, `Remetente: ${env.EMAIL_FROM}`],
    [
      "Imagens",
      env.STORAGE_DRIVER === "s3" ? "S3 ou compatível" : "Pasta local (uploads)",
      "Definido pela variável STORAGE_DRIVER.",
    ],
  ];
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Tudo o que a loja mostra de contato, prazo e desconto vem daqui. Salvar atualiza a loja na hora e fica registrado na auditoria."
      />
      <EntityForm
        fields={fields}
        initial={initial}
        action={saveSettingsAction}
        submitLabel="Salvar configurações"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integrações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="flex flex-col gap-2">
              {integrations.map(([name, mode, detail]) => (
                <li key={name}>
                  <span className="font-medium">{name}:</span> {mode}
                  <span className="block text-xs text-muted-foreground">{detail}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-muted-foreground">
              As integrações são escolhidas por variáveis de ambiente, não por esta tela. O passo a
              passo para ligar um gateway de pagamento, uma transportadora ou outro provedor está em
              docs/INTEGRACOES.md, no repositório.
            </p>
          </CardContent>
        </Card>
      </EntityForm>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Enviar e-mail de teste</CardTitle>
        </CardHeader>
        <CardContent>
          <MiniForm
            fields={[{ name: "to", label: "Enviar para", type: "email" }]}
            initial={{ to: user.email }}
            action={sendTest}
            submitLabel="Enviar e-mail de teste"
          />
        </CardContent>
      </Card>
    </>
  );
}
