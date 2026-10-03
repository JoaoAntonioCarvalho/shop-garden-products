import { Column, Hr, Link, Row, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";
import {
  EmailButton,
  emailColors,
  EmailLayout,
  emailStyles,
  Paragraph,
  type EmailStore,
} from "./layout";

/** Tudo aqui é serializável: o payload fica no EmailLog e permite ver e reenviar o e-mail. */
export type OrderEmailData = {
  number: string;
  /** Link do pedido com o token de acesso. */
  url: string;
  customerName: string;
  items: Array<{ name: string; variant: string | null; quantity: number; total: string }>;
  totals: {
    subtotal: string;
    discount: string | null;
    pixDiscount: string | null;
    shipping: string;
    giftWrap: string | null;
    total: string;
  };
  shippingMethod: string;
  /** "Hoje, até 20h", "sábado, 3 de outubro, manhã" ou "4 a 7 dias úteis". */
  deliveryInfo: string;
  addressLines: string[];
  paymentMethod: string;
  giftMessage: string | null;
  pix?: { payload: string; expiresAt: string } | null;
  boleto?: { line: string; dueDate: string; url: string } | null;
  failureReason?: string | null;
  trackingCode?: string | null;
  carrier?: string | null;
  cancelReason?: string | null;
  refunded?: boolean;
  /** Link direto para avaliar cada item (e-mail de pedido entregue). */
  reviewLinks?: Array<{ name: string; url: string }>;
  /** Mudança de status sem modelo próprio (por exemplo "Pronto para retirada"). */
  statusLabel?: string;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

function OrderSummary({ order }: { order: OrderEmailData }) {
  const row = (label: string, value: string, strong = false) => (
    <Row key={label}>
      <Column>
        <Text
          style={{
            ...emailStyles.small,
            color: emailColors.ink,
            fontWeight: strong ? 700 : 400,
            margin: "0 0 4px",
          }}
        >
          {label}
        </Text>
      </Column>
      <Column align="right">
        <Text
          style={{
            ...emailStyles.small,
            color: emailColors.ink,
            fontWeight: strong ? 700 : 400,
            margin: "0 0 4px",
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  );
  return (
    <>
      <Text style={emailStyles.subheading}>Resumo do pedido {order.number}</Text>
      {order.items.map((item, index) => (
        <Row key={index}>
          <Column>
            <Text style={{ ...emailStyles.small, color: emailColors.ink, margin: "0 0 6px" }}>
              {item.quantity}x {item.name}
              {item.variant ? ` (${item.variant})` : ""}
            </Text>
          </Column>
          <Column align="right">
            <Text style={{ ...emailStyles.small, color: emailColors.ink, margin: "0 0 6px" }}>
              {item.total}
            </Text>
          </Column>
        </Row>
      ))}
      <Hr style={{ borderColor: emailColors.line, margin: "12px 0" }} />
      {row("Subtotal", order.totals.subtotal)}
      {order.totals.discount ? row("Cupom", `- ${order.totals.discount}`) : null}
      {order.totals.pixDiscount ? row("Desconto do Pix", `- ${order.totals.pixDiscount}`) : null}
      {order.totals.giftWrap ? row("Embalagem para presente", order.totals.giftWrap) : null}
      {row("Frete", order.totals.shipping)}
      {row("Total", order.totals.total, true)}
      <Text style={emailStyles.subheading}>Entrega</Text>
      <Text style={emailStyles.small}>
        {order.shippingMethod}: {order.deliveryInfo}
      </Text>
      {order.addressLines.map((line) => (
        <Text key={line} style={{ ...emailStyles.small, margin: 0 }}>
          {line}
        </Text>
      ))}
      {order.giftMessage ? (
        <>
          <Text style={emailStyles.subheading}>Mensagem do cartão</Text>
          <Text style={{ ...emailStyles.small, fontStyle: "italic" }}>{order.giftMessage}</Text>
        </>
      ) : null}
    </>
  );
}

type OrderProps = { store: EmailStore; order: OrderEmailData };

function OrderReceived({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`Recebemos o pedido ${order.number}.`}
      heading={`Pedido ${order.number} recebido`}
    >
      <Paragraph>Olá, {firstName(order.customerName)}. Recebemos o seu pedido.</Paragraph>
      {order.pix ? (
        <>
          <Paragraph>
            Para concluir, pague com Pix até {order.pix.expiresAt}. Copie o código abaixo e cole no
            aplicativo do seu banco, na opção Pix copia e cola.
          </Paragraph>
          <Text style={emailStyles.code}>{order.pix.payload}</Text>
          <EmailButton href={order.url}>Ver QR Code do Pix</EmailButton>
        </>
      ) : null}
      {order.boleto ? (
        <>
          <Paragraph>
            Pague o boleto até {order.boleto.dueDate}. A confirmação pode levar até 3 dias úteis.
          </Paragraph>
          <Text style={emailStyles.code}>{order.boleto.line}</Text>
          <EmailButton href={order.boleto.url}>Abrir boleto</EmailButton>
        </>
      ) : null}
      {!order.pix && !order.boleto ? (
        <EmailButton href={order.url}>Acompanhar pedido</EmailButton>
      ) : null}
      <OrderSummary order={order} />
    </EmailLayout>
  );
}

function PaymentApproved({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`O pagamento do pedido ${order.number} foi aprovado.`}
      heading="Pagamento aprovado"
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. O pagamento do pedido {order.number} foi aprovado e já
        vamos preparar tudo.
      </Paragraph>
      <Paragraph>Entrega: {order.deliveryInfo}.</Paragraph>
      <EmailButton href={order.url}>Acompanhar pedido</EmailButton>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}

function PaymentFailed({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`O pagamento do pedido ${order.number} não foi aprovado.`}
      heading="O pagamento não foi aprovado"
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. O pagamento do pedido {order.number} não foi aprovado
        {order.failureReason ? `: ${order.failureReason.toLowerCase()}` : ""}.
      </Paragraph>
      <Paragraph>
        Os produtos continuam reservados por um tempo. Você pode tentar com outro cartão ou pagar
        com Pix.
      </Paragraph>
      <EmailButton href={order.url}>Tentar outro pagamento</EmailButton>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}

function PixExpired({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`O Pix do pedido ${order.number} expirou.`}
      heading="O prazo do Pix terminou"
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. O código Pix do pedido {order.number} expirou antes do
        pagamento, e o pedido foi encerrado.
      </Paragraph>
      <Paragraph>
        Se ainda quiser os produtos, é só refazer o pedido: sua sacola continua guardada.
      </Paragraph>
      <EmailButton href={`${store.url}/carrinho?recuperar=${order.number}`}>
        Refazer o pedido
      </EmailButton>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}

function OrderPreparing({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`O pedido ${order.number} está em preparação.`}
      heading="Seu pedido está em preparação"
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. Estamos separando e embalando o pedido {order.number}{" "}
        com cuidado.
      </Paragraph>
      <Paragraph>Entrega: {order.deliveryInfo}.</Paragraph>
      <EmailButton href={order.url}>Acompanhar pedido</EmailButton>
    </EmailLayout>
  );
}

function OrderShipped({ store, order }: OrderProps) {
  const local = !order.trackingCode;
  return (
    <EmailLayout
      store={store}
      preview={
        local
          ? `O pedido ${order.number} saiu para entrega.`
          : `O pedido ${order.number} foi enviado.`
      }
      heading={local ? "Seu pedido saiu para entrega" : "Seu pedido foi enviado"}
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}.{" "}
        {local
          ? `O pedido ${order.number} está a caminho com o nosso entregador.`
          : `O pedido ${order.number} foi entregue à transportadora.`}
      </Paragraph>
      {order.trackingCode ? (
        <Section style={emailStyles.box}>
          <Text style={{ ...emailStyles.small, margin: 0 }}>
            Código de rastreio{order.carrier ? ` (${order.carrier})` : ""}
          </Text>
          <Text style={{ ...emailStyles.text, fontWeight: 700, margin: 0 }}>
            {order.trackingCode}
          </Text>
        </Section>
      ) : (
        <Paragraph>Deixe o telefone por perto: o entregador pode ligar ao chegar.</Paragraph>
      )}
      <EmailButton href={order.url}>Acompanhar pedido</EmailButton>
    </EmailLayout>
  );
}

function OrderDelivered({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`O pedido ${order.number} foi entregue.`}
      heading="Pedido entregue"
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. O pedido {order.number} foi entregue. Esperamos que
        tenha chegado tudo como você imaginava.
      </Paragraph>
      {order.reviewLinks?.length ? (
        <>
          <Paragraph>
            Sua opinião ajuda outros clientes a escolher. Avalie o que você comprou:
          </Paragraph>
          {order.reviewLinks.map((item) => (
            <Text key={item.url} style={{ ...emailStyles.text, margin: "0 0 8px" }}>
              <Link
                href={item.url}
                style={{ color: emailColors.moss, textDecoration: "underline" }}
              >
                Avaliar {item.name}
              </Link>
            </Text>
          ))}
        </>
      ) : null}
      <Paragraph>Se algo não chegou bem, responda este e-mail com fotos em até 48 horas.</Paragraph>
    </EmailLayout>
  );
}

function OrderCanceled({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`O pedido ${order.number} foi cancelado.`}
      heading="Pedido cancelado"
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. O pedido {order.number} foi cancelado
        {order.cancelReason ? `. Motivo: ${order.cancelReason}` : ""}.
      </Paragraph>
      {order.refunded ? (
        <Paragraph>
          O valor pago será devolvido pelo mesmo meio de pagamento. O prazo depende do banco ou da
          operadora do cartão.
        </Paragraph>
      ) : null}
      <OrderSummary order={order} />
    </EmailLayout>
  );
}

function OrderStatusUpdate({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`Novidade no pedido ${order.number}.`}
      heading={order.statusLabel ?? "Atualização do pedido"}
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. O pedido {order.number} mudou de status:{" "}
        {order.statusLabel?.toLowerCase()}.
      </Paragraph>
      <EmailButton href={order.url}>Acompanhar pedido</EmailButton>
    </EmailLayout>
  );
}

function OrderManualSummary({ store, order }: OrderProps) {
  return (
    <EmailLayout
      store={store}
      preview={`Resumo do pedido ${order.number}.`}
      heading={`Pedido ${order.number}`}
    >
      <Paragraph>
        Olá, {firstName(order.customerName)}. Este é o resumo do pedido que combinamos no
        atendimento.
      </Paragraph>
      {order.pix ? (
        <>
          <Paragraph>Para pagar com Pix, copie o código abaixo ou abra o link do pedido.</Paragraph>
          <Text style={emailStyles.code}>{order.pix.payload}</Text>
        </>
      ) : null}
      <EmailButton href={order.url}>{order.pix ? "Pagar o pedido" : "Ver o pedido"}</EmailButton>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}

function InternalNewOrder({ store, order }: OrderProps & { adminUrl?: string }) {
  return (
    <EmailLayout
      store={store}
      preview={`Novo pedido pago: ${order.number}, ${order.totals.total}.`}
      heading={`Novo pedido pago: ${order.number}`}
    >
      <Paragraph>
        {order.customerName} pagou {order.totals.total} com {order.paymentMethod.toLowerCase()}.
        Entrega: {order.shippingMethod}, {order.deliveryInfo}.
      </Paragraph>
      <EmailButton href={`${store.url}/admin/pedidos/${order.number}`}>Abrir no painel</EmailButton>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}

// ───────────────────────── Conta, leads e demais ─────────────────────────

type ActionProps = {
  store: EmailStore;
  preview: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Texto em destaque (cupom, por exemplo). */
  highlight?: string;
  after?: string[];
  unsubscribeUrl?: string;
};

/** Modelo genérico: título, parágrafos e um botão. */
function ActionEmail({
  store,
  preview,
  heading,
  paragraphs,
  button,
  highlight,
  after,
  unsubscribeUrl,
}: ActionProps) {
  return (
    <EmailLayout
      store={store}
      preview={preview}
      heading={heading}
      footerNote={
        unsubscribeUrl ? (
          <Text style={emailStyles.small}>
            Não quer mais receber?{" "}
            <Link
              href={unsubscribeUrl}
              style={{ color: emailColors.moss, textDecoration: "underline" }}
            >
              Cancelar o recebimento
            </Link>
            .
          </Text>
        ) : undefined
      }
    >
      {paragraphs.map((text) => (
        <Paragraph key={text}>{text}</Paragraph>
      ))}
      {highlight ? (
        <Text
          style={{
            ...emailStyles.code,
            fontSize: "20px",
            fontWeight: 700,
            textAlign: "center",
            letterSpacing: "1px",
          }}
        >
          {highlight}
        </Text>
      ) : null}
      {button ? <EmailButton href={button.url}>{button.label}</EmailButton> : null}
      {after?.map((text) => (
        <Text key={text} style={emailStyles.small}>
          {text}
        </Text>
      ))}
    </EmailLayout>
  );
}

type ListProps = {
  store: EmailStore;
  preview: string;
  heading: string;
  intro: string;
  rows: Array<[label: string, value: string]>;
  button?: { label: string; url: string };
};

/** Modelo de notificação interna: lista de rótulo e valor. */
function ListEmail({ store, preview, heading, intro, rows, button }: ListProps) {
  return (
    <EmailLayout store={store} preview={preview} heading={heading}>
      <Paragraph>{intro}</Paragraph>
      <Section style={emailStyles.box}>
        {rows.map(([label, value]) => (
          <Text
            key={label}
            style={{ ...emailStyles.small, color: emailColors.ink, margin: "0 0 6px" }}
          >
            <strong>{label}:</strong> {value}
          </Text>
        ))}
      </Section>
      {button ? <EmailButton href={button.url}>{button.label}</EmailButton> : null}
    </EmailLayout>
  );
}

export type CartEmailData = {
  customerName: string | null;
  items: Array<{ name: string; quantity: number }>;
  total: string;
  url: string;
  unsubscribeUrl?: string;
};

/** Catálogo de modelos. A chave fica gravada em EmailLog.template. */
export const emailTemplates = {
  "order-received": {
    label: "Pedido recebido",
    subject: (p: { order: OrderEmailData }) => `Pedido ${p.order.number} recebido`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <OrderReceived store={store} order={p.order} />
    ),
  },
  "payment-approved": {
    label: "Pagamento aprovado",
    subject: (p: { order: OrderEmailData }) => `Pagamento aprovado: pedido ${p.order.number}`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <PaymentApproved store={store} order={p.order} />
    ),
  },
  "payment-failed": {
    label: "Pagamento recusado",
    subject: (p: { order: OrderEmailData }) =>
      `O pagamento do pedido ${p.order.number} não foi aprovado`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <PaymentFailed store={store} order={p.order} />
    ),
  },
  "pix-expired": {
    label: "Pix expirado",
    subject: (p: { order: OrderEmailData }) => `O Pix do pedido ${p.order.number} expirou`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <PixExpired store={store} order={p.order} />
    ),
  },
  "order-preparing": {
    label: "Pedido em preparação",
    subject: (p: { order: OrderEmailData }) => `Pedido ${p.order.number} em preparação`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <OrderPreparing store={store} order={p.order} />
    ),
  },
  "order-shipped": {
    label: "Pedido enviado ou saiu para entrega",
    subject: (p: { order: OrderEmailData }) =>
      p.order.trackingCode
        ? `Pedido ${p.order.number} enviado`
        : `Pedido ${p.order.number} saiu para entrega`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <OrderShipped store={store} order={p.order} />
    ),
  },
  "order-delivered": {
    label: "Pedido entregue",
    subject: (p: { order: OrderEmailData }) => `Pedido ${p.order.number} entregue`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <OrderDelivered store={store} order={p.order} />
    ),
  },
  "order-canceled": {
    label: "Pedido cancelado",
    subject: (p: { order: OrderEmailData }) => `Pedido ${p.order.number} cancelado`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <OrderCanceled store={store} order={p.order} />
    ),
  },
  "order-status": {
    label: "Atualização de status",
    subject: (p: { order: OrderEmailData }) =>
      `Pedido ${p.order.number}: ${(p.order.statusLabel ?? "atualização").toLowerCase()}`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <OrderStatusUpdate store={store} order={p.order} />
    ),
  },
  "order-manual-summary": {
    label: "Resumo de pedido manual",
    subject: (p: { order: OrderEmailData }) => `Resumo do pedido ${p.order.number}`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <OrderManualSummary store={store} order={p.order} />
    ),
  },
  "internal-new-order": {
    label: "Interno: novo pedido pago",
    subject: (p: { order: OrderEmailData }) =>
      `Novo pedido pago: ${p.order.number} (${p.order.totals.total})`,
    render: (store: EmailStore, p: { order: OrderEmailData }) => (
      <InternalNewOrder store={store} order={p.order} />
    ),
  },
  "welcome-coupon": {
    label: "Boas-vindas com cupom",
    subject: (p: { percent: number }) => `Seu cupom de ${p.percent}% na primeira compra`,
    render: (
      store: EmailStore,
      p: { coupon: string; percent: number; confirmUrl: string; unsubscribeUrl: string },
    ) => (
      <ActionEmail
        store={store}
        preview={`Use o cupom ${p.coupon} e ganhe ${p.percent}% na primeira compra.`}
        heading="Seu cupom chegou"
        paragraphs={[
          `Obrigado por se cadastrar. Use o código abaixo na sacola e ganhe ${p.percent}% de desconto na primeira compra.`,
        ]}
        highlight={p.coupon}
        button={{ label: "Confirmar meu e-mail", url: p.confirmUrl }}
        after={[
          "Confirme o seu e-mail no botão acima para continuar recebendo novidades e ofertas.",
        ]}
        unsubscribeUrl={p.unsubscribeUrl}
      />
    ),
  },
  "account-created": {
    label: "Criação de conta e verificação de e-mail",
    subject: () => "Confirme o seu e-mail",
    render: (store: EmailStore, p: { name: string; verifyUrl: string }) => (
      <ActionEmail
        store={store}
        preview="Confirme o seu e-mail para concluir o cadastro."
        heading="Sua conta foi criada"
        paragraphs={[
          `Olá, ${firstName(p.name)}. Sua conta na ${store.name} está pronta. Confirme o seu e-mail para acompanhar pedidos e salvar endereços.`,
        ]}
        button={{ label: "Confirmar e-mail", url: p.verifyUrl }}
        after={["O link vale por 24 horas. Se você não criou esta conta, ignore este e-mail."]}
      />
    ),
  },
  "email-verification": {
    label: "Verificação de novo e-mail",
    subject: () => "Confirme o seu novo e-mail",
    render: (store: EmailStore, p: { name: string; verifyUrl: string }) => (
      <ActionEmail
        store={store}
        preview="Confirme o seu novo e-mail."
        heading="Confirme o seu e-mail"
        paragraphs={[
          `Olá, ${firstName(p.name)}. Clique no botão para confirmar este endereço de e-mail.`,
        ]}
        button={{ label: "Confirmar e-mail", url: p.verifyUrl }}
        after={["O link vale por 24 horas. Se você não pediu esta alteração, ignore este e-mail."]}
      />
    ),
  },
  "password-reset": {
    label: "Redefinição de senha",
    subject: () => "Redefinir a senha",
    render: (store: EmailStore, p: { name: string; resetUrl: string }) => (
      <ActionEmail
        store={store}
        preview="Use o link para criar uma nova senha."
        heading="Redefinir a senha"
        paragraphs={[
          `Olá, ${firstName(p.name)}. Recebemos um pedido para redefinir a senha da sua conta.`,
        ]}
        button={{ label: "Criar nova senha", url: p.resetUrl }}
        after={[
          "O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu a troca, ignore este e-mail: sua senha continua a mesma.",
        ]}
      />
    ),
  },
  "team-invite": {
    label: "Convite para a equipe",
    subject: (p: { storeName: string }) => `Convite para o painel da ${p.storeName}`,
    render: (store: EmailStore, p: { name: string; inviteUrl: string; storeName: string }) => (
      <ActionEmail
        store={store}
        preview="Defina a sua senha para acessar o painel."
        heading="Você foi convidado para a equipe"
        paragraphs={[
          `Olá, ${firstName(p.name)}. Você recebeu acesso ao painel administrativo da ${store.name}. Defina a sua senha para entrar.`,
        ]}
        button={{ label: "Definir senha", url: p.inviteUrl }}
        after={["O link vale por 1 hora e só pode ser usado uma vez."]}
      />
    ),
  },
  "back-in-stock": {
    label: "Produto de volta ao estoque",
    subject: (p: { productName: string }) => `Chegou: ${p.productName}`,
    render: (store: EmailStore, p: { productName: string; productUrl: string }) => (
      <ActionEmail
        store={store}
        preview={`${p.productName} está disponível de novo.`}
        heading="O produto que você queria chegou"
        paragraphs={[`${p.productName} voltou ao estoque. As unidades são limitadas.`]}
        button={{ label: "Ver produto", url: p.productUrl }}
        after={[
          "Você recebeu este aviso porque pediu para ser avisado quando o produto chegasse. Não enviaremos outros e-mails por causa deste pedido.",
        ]}
      />
    ),
  },
  "abandoned-cart": {
    label: "Carrinho abandonado",
    subject: () => "Sua sacola está guardada",
    render: (store: EmailStore, p: { cart: CartEmailData }) => (
      <ActionEmail
        store={store}
        preview="Os produtos que você escolheu continuam na sua sacola."
        heading="Sua sacola está guardada"
        paragraphs={[
          `${p.cart.customerName ? `Olá, ${firstName(p.cart.customerName)}. ` : ""}Você deixou estes produtos na sacola: ${p.cart.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}.`,
          `Total: ${p.cart.total}. Se tiver alguma dúvida antes de finalizar, é só responder este e-mail.`,
        ]}
        button={{ label: "Voltar para a sacola", url: p.cart.url }}
        unsubscribeUrl={p.cart.unsubscribeUrl}
      />
    ),
  },
  "data-export-ready": {
    label: "LGPD: pedido de dados concluído",
    subject: () => "Seu pedido sobre dados pessoais foi concluído",
    render: (store: EmailStore, p: { name: string; message: string }) => (
      <ActionEmail
        store={store}
        preview={p.message}
        heading="Pedido concluído"
        paragraphs={[`Olá, ${firstName(p.name)}.`, p.message]}
      />
    ),
  },
  "internal-product-request": {
    label: "Interno: nova solicitação de produto",
    subject: (p: { name: string }) => `Nova solicitação de produto: ${p.name}`,
    render: (
      store: EmailStore,
      p: { name: string; email: string; whatsapp: string; description: string; budget: string },
    ) => (
      <ListEmail
        store={store}
        preview={`${p.name} pediu um produto que não encontrou.`}
        heading="Nova solicitação de produto"
        intro="Um cliente não encontrou o que procurava e pediu ajuda."
        rows={[
          ["Nome", p.name],
          ["E-mail", p.email],
          ["WhatsApp", p.whatsapp || "não informado"],
          ["Orçamento", p.budget || "não informado"],
          ["Pedido", p.description],
        ]}
        button={{ label: "Abrir no painel", url: `${store.url}/admin/solicitacoes` }}
      />
    ),
  },
  "internal-contact": {
    label: "Interno: nova mensagem de contato",
    subject: (p: { subject: string }) => `Nova mensagem de contato: ${p.subject}`,
    render: (
      store: EmailStore,
      p: {
        name: string;
        email: string;
        phone: string;
        subject: string;
        orderNumber: string;
        message: string;
      },
    ) => (
      <ListEmail
        store={store}
        preview={`${p.name}: ${p.subject}`}
        heading="Nova mensagem de contato"
        intro="Uma mensagem chegou pelo formulário de contato."
        rows={[
          ["Nome", p.name],
          ["E-mail", p.email],
          ["Telefone", p.phone || "não informado"],
          ["Pedido", p.orderNumber || "não informado"],
          ["Assunto", p.subject],
          ["Mensagem", p.message],
        ]}
        button={{ label: "Abrir no painel", url: `${store.url}/admin/contatos` }}
      />
    ),
  },
  "internal-low-stock": {
    label: "Interno: resumo de estoque baixo",
    subject: (p: { items: unknown[] }) =>
      `Estoque baixo: ${p.items.length} ${p.items.length === 1 ? "variação" : "variações"}`,
    render: (
      store: EmailStore,
      p: { items: Array<{ name: string; sku: string; available: number }> },
    ) => (
      <ListEmail
        store={store}
        preview={`${p.items.length} variações com estoque baixo ou zerado.`}
        heading="Resumo de estoque baixo"
        intro="Estas variações estão com estoque baixo ou zerado."
        rows={p.items.map((item) => [
          `${item.name} (${item.sku})`,
          item.available === 0 ? "zerado" : `${item.available} disponíveis`,
        ])}
        button={{ label: "Abrir o estoque", url: `${store.url}/admin/estoque?status=baixo` }}
      />
    ),
  },
  test: {
    label: "E-mail de teste",
    subject: () => "E-mail de teste",
    render: (store: EmailStore, p: { sentBy: string }) => (
      <ActionEmail
        store={store}
        preview="O envio de e-mails está funcionando."
        heading="E-mail de teste"
        paragraphs={[
          `Este é um e-mail de teste enviado pelo painel por ${p.sentBy}. Se você está lendo, o envio está funcionando.`,
        ]}
      />
    ),
  },
} satisfies Record<
  string,
  {
    label: string;
    subject: (props: never) => string;
    render: (store: EmailStore, props: never) => ReactElement;
  }
>;

export type EmailTemplateName = keyof typeof emailTemplates;
export type EmailTemplateProps<T extends EmailTemplateName> = Parameters<
  (typeof emailTemplates)[T]["render"]
>[1];
