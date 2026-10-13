import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { EntityForm, type FieldDef, type FormValues } from "@/components/admin/entity-form";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatCentsPlain } from "@/lib/money";
import { saveStoreInfoAction } from "@/server/actions/admin/system";
import { getStoreSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Informações da loja" };

const fields: FieldDef[] = [
  {
    name: "businessHours",
    label: "Horário de atendimento",
    type: "text",
    section: "Atendimento",
    wide: true,
    help: "Aparece no rodapé, na página de contato e na Ajuda.",
  },
  {
    name: "whatsapp",
    label: "WhatsApp (só números, com 55 e DDD)",
    type: "text",
    section: "Atendimento",
    help: "Por exemplo: 5511999999999.",
  },
  {
    name: "phoneDisplay",
    label: "Telefone como aparece na loja",
    type: "text",
    section: "Atendimento",
  },
  { name: "email", label: "E-mail de atendimento", type: "email", section: "Atendimento" },
  {
    name: "instagram",
    label: "Instagram (endereço completo)",
    type: "text",
    section: "Atendimento",
  },
  {
    name: "pickupInstructions",
    label: "Orientações e horário da retirada",
    type: "textarea",
    section: "Retirada na loja",
    wide: true,
    help: "É o texto que o cliente lê ao escolher retirar: no frete, no checkout, na página de Entrega e na Ajuda.",
  },
  { name: "pickupStreet", label: "Rua ou avenida", type: "text", section: "Retirada na loja" },
  { name: "pickupNumber", label: "Número", type: "text", section: "Retirada na loja" },
  { name: "pickupDistrict", label: "Bairro", type: "text", section: "Retirada na loja" },
  { name: "pickupCity", label: "Cidade", type: "text", section: "Retirada na loja" },
  { name: "pickupState", label: "Estado (sigla)", type: "text", section: "Retirada na loja" },
  { name: "pickupCep", label: "CEP", type: "text", section: "Retirada na loja" },
  {
    name: "ownDeliveryNote",
    label: "Dias e horário da entrega própria",
    type: "textarea",
    section: "Entrega e prazos",
    wide: true,
    help: "Aparece na opção Entrega própria, ao calcular o frete e no checkout.",
  },
  {
    name: "orderHandlingNotice",
    label: "Prazo para separar e enviar",
    type: "textarea",
    section: "Entrega e prazos",
    wide: true,
    help: "Aparece na confirmação do pedido e no e-mail de pagamento aprovado.",
  },
  {
    name: "freeShippingThresholdCents",
    label: "Frete grátis a partir de (R$)",
    type: "money",
    section: "Entrega e prazos",
    help: "Valor mostrado na faixa do topo do site. Cada regra de frete pode ter o seu próprio valor.",
  },
  {
    name: "pixDiscountPercent",
    label: "Desconto no Pix (%)",
    type: "number",
    section: "Pagamento",
  },
  {
    name: "maxInstallments",
    label: "Parcelas sem juros (máximo)",
    type: "number",
    section: "Pagamento",
  },
  {
    name: "minInstallmentCents",
    label: "Parcela mínima (R$)",
    type: "money",
    section: "Pagamento",
  },
];

export default async function StoreInfoPage() {
  await requireAdminPage("settings.manage");
  const settings = await getStoreSettings();
  const initial: FormValues = {
    businessHours: settings.businessHours,
    whatsapp: settings.whatsapp,
    phoneDisplay: settings.phoneDisplay,
    email: settings.email,
    instagram: settings.instagram,
    pickupInstructions: settings.pickupInstructions,
    pickupStreet: settings.pickupAddress.street,
    pickupNumber: settings.pickupAddress.number,
    pickupDistrict: settings.pickupAddress.district,
    pickupCity: settings.pickupAddress.city,
    pickupState: settings.pickupAddress.state,
    pickupCep: settings.pickupAddress.cep,
    ownDeliveryNote: settings.ownDeliveryNote,
    orderHandlingNotice: settings.orderHandlingNotice,
    freeShippingThresholdCents: formatCentsPlain(settings.freeShippingThresholdCents),
    pixDiscountPercent: settings.pixDiscountPercent,
    maxInstallments: settings.maxInstallments,
    minInstallmentCents: formatCentsPlain(settings.minInstallmentCents),
  };
  return (
    <>
      <PageHeader
        title="Informações da loja"
        description="Horários, retirada, prazos e contatos que o cliente vê no site. Altere o texto e clique em Salvar: a loja mostra o dado novo na hora."
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Os valores de frete por CEP ficam em{" "}
        <Link href="/admin/frete" className="text-primary underline underline-offset-2">
          Frete e entrega
        </Link>
        . Dados da empresa, cupom de boas-vindas e modo manutenção ficam em{" "}
        <Link href="/admin/configuracoes" className="text-primary underline underline-offset-2">
          Configurações
        </Link>
        .
      </p>
      <EntityForm
        fields={fields}
        initial={initial}
        action={saveStoreInfoAction}
        submitLabel="Salvar informações"
      />
    </>
  );
}
