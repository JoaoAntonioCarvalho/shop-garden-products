"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { CouponField } from "@/components/store/coupon-field";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ShippingCalculator } from "@/components/store/shipping-calculator";
import { Button } from "@/components/ui/button";
import { Checkbox, Radio, Switch } from "@/components/ui/choice";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { demoApplyCoupon, demoQuote, demoRemoveCoupon, demoSubscribe } from "./demo-actions";

export function FormDemo() {
  const [quantity, setQuantity] = useState(2);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Field label="Nome completo" required>
        <Input name="nome" autoComplete="name" placeholder="Como está no documento" />
      </Field>
      <Field label="E-mail" hint="Enviamos a confirmação do pedido para este endereço.">
        <Input name="email" type="email" defaultValue="cliente@example.com" />
      </Field>
      <Field label="CPF" error="Este CPF não é válido. Confira os números.">
        <MaskedInput mask="cpf" defaultValue="11122233344" />
      </Field>
      <Field label="CEP">
        <MaskedInput mask="cep" />
      </Field>
      <Field label="Celular com DDD">
        <MaskedInput mask="phone" />
      </Field>
      <Field label="Número do cartão">
        <MaskedInput mask="card" />
      </Field>
      <Field label="Validade">
        <MaskedInput mask="expiry" />
      </Field>
      <Field label="Campo desabilitado">
        <Input disabled defaultValue="Não editável" />
      </Field>
      <Field label="Período de entrega">
        <Select defaultValue="manha">
          <option value="manha">Manhã, das 8h às 12h</option>
          <option value="tarde">Tarde, das 13h às 18h</option>
        </Select>
      </Field>
      <Field label="Mensagem do cartão" optional hint="Até 240 caracteres.">
        <Textarea maxLength={240} placeholder="Escreva a mensagem que vai junto com o presente" />
      </Field>
      <fieldset>
        <legend className="type-small font-medium text-ink">Caixas de seleção</legend>
        <Checkbox label="Quero receber novidades e ofertas por e-mail" />
        <Checkbox label="Marcada" defaultChecked />
        <Checkbox label="Desabilitada" disabled />
      </fieldset>
      <fieldset>
        <legend className="type-small font-medium text-ink">Forma de pagamento</legend>
        <Radio name="demo-pagamento" label="Pix" description="5% de desconto" defaultChecked />
        <Radio name="demo-pagamento" label="Cartão de crédito" />
        <Radio
          name="demo-pagamento"
          label="Boleto"
          description="Indisponível para entrega hoje"
          disabled
        />
      </fieldset>
      <div>
        <Switch label="Embalagem para presente" />
        <Switch label="Ativado" defaultChecked />
      </div>
      <div className="flex flex-col gap-2">
        <span className="type-small font-medium text-ink">Quantidade (máximo 5)</span>
        <QuantityStepper value={quantity} onChange={setQuantity} max={5} label="vaso de cerâmica" />
        <QuantityStepper value={1} onChange={() => {}} disabled size="sm" />
      </div>
    </div>
  );
}

export function OverlayDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Dialog
        title="Remover item da sacola"
        description="O item sai da sacola, mas você pode adicioná-lo de novo quando quiser."
        trigger={<Button variant="secondary">Abrir modal</Button>}
        footer={<Button>Remover item</Button>}
      >
        <p className="type-body">Vaso de cerâmica vitrificada verde-musgo, tamanho M.</p>
      </Dialog>
      <Drawer
        title="Sacola"
        trigger={
          <Button
            variant="secondary"
            icon={<ShoppingBag aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          >
            Abrir gaveta
          </Button>
        }
        footer={<Button className="w-full">Finalizar compra</Button>}
      >
        <p className="type-body">Lateral no desktop e inferior no celular.</p>
      </Drawer>
      <Button variant="ghost" onClick={() => toast("Adicionado à sacola")}>
        Mostrar aviso
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          toast("Item removido da sacola", {
            action: { label: "Desfazer", onClick: () => toast("Item devolvido à sacola") },
          })
        }
      >
        Aviso com desfazer
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          toast("Não foi possível salvar o endereço. Tente de novo.", { tone: "error" })
        }
      >
        Aviso de erro
      </Button>
      <Tooltip content="Plantas vivas são entregues apenas na Grande São Paulo.">
        <Button variant="ghost">Dica ao focar</Button>
      </Tooltip>
    </div>
  );
}

export function CommerceDemo({
  storeName,
  discountPercent,
}: {
  storeName: string;
  discountPercent: number;
}) {
  const [applied, setApplied] = useState<{ code: string; summary: string } | null>(null);
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <ShippingCalculator quote={demoQuote} />
      <CouponField
        applied={applied}
        apply={async (code) => {
          const result = await demoApplyCoupon(code);
          if (result.ok)
            setApplied({ code: code.toUpperCase(), summary: `${discountPercent}% de desconto` });
          return result;
        }}
        remove={async () => {
          setApplied(null);
          return demoRemoveCoupon();
        }}
      />
      <div className="md:col-span-2">
        <NewsletterForm
          submit={demoSubscribe}
          source="FOOTER"
          storeName={storeName}
          discountPercent={discountPercent}
        />
      </div>
    </div>
  );
}
