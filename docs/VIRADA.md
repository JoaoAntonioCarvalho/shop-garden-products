# Roteiro da virada

Passo a passo para colocar a loja nova no domínio `netshopgarden.com.br`. A ordem importa: cada bloco depende do anterior. "Dev" é quem cuida do site; "Dona" é a dona da loja.

O detalhe de cada integração está em `docs/INTEGRACOES.md`, e a zona de DNS completa em `docs/PENDENCIAS-DO-DONO.md`, seção "Domínio e DNS".

## Antes do dia (pode ser feito em qualquer ordem)

| O quê                                                                                            | Quem | Como conferir                                                   |
| ------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------- |
| Pix de teste depois da URL de notificação salva na Cielo (salva em 11/10/2026)                   | Dev  | Um Pix de teste muda o pedido para pago sozinho                 |
| Comprar com cartão de verdade no site e cancelar o pedido com devolução                          | Dev  | Estorno aparece no pedido e na Cielo                            |
| Gerar nova `MerchantKey`, novo `ClientSecret` e nova chave do Resend, e trocar na Vercel         | Dev  | Um Pix de teste continua funcionando                            |
| Trazer a tabela de frete da entrega própria por região e as regras dos Correios do site antigo   | Dona | Regras de frete e áreas de entrega cadastradas em Admin > Frete |
| Conferir os textos de Entrega, Trocas, Privacidade e Termos com as respostas (e com um advogado) | Dona | Admin > Páginas                                                 |
| Decidir os 34 produtos da fila "A revisar"                                                       | Dona | Admin > Curadoria com a fila vazia                              |
| Informar o estoque real (hoje todos os produtos têm 10 unidades)                                 | Dona | Admin > Estoque                                                 |
| Passar a Vercel para o plano Pro (o gratuito não permite uso comercial)                          | Dev  | Painel da Vercel                                                |
| Trocar a senha do usuário "Administrador" inicial (`katia` e `staffnet` já existem)              | Dev  | Admin > Usuários                                                |

## No dia, de preferência à noite

A troca de DNS derruba o site antigo e deixa o e-mail em espera até os registros serem recriados. E-mails enviados à loja nesse intervalo chegam depois, não se perdem.

1. **Vercel, domínio.** Em Settings > Domains, adicionar `netshopgarden.com.br` e `www.netshopgarden.com.br`. Anotar os dois valores de DNS que a Vercel mostrar.
2. **registro.br, servidores de DNS.** No domínio, clicar em "Utilizar DNS do Registro.br" e salvar.
3. **registro.br, zona.** Em "Configurar zona DNS", modo avançado, criar os registros nesta ordem:
   1. `A` da raiz e `CNAME` do `www`, com os valores da Vercel.
   2. Os quatro `MX` da Locaweb.
   3. O `TXT` de SPF e os `CNAME` de e-mail (`pop`, `smtp`, `imap`, `mail`, `webmail`, `autodiscover`).
   4. Os registros do Resend (`resend._domainkey`, `rsend`, `send`, `_dmarc`).
4. **Conferir o DNS.** `dig +short A netshopgarden.com.br` e `dig +short MX netshopgarden.com.br` precisam devolver os valores novos. Mandar um e-mail de teste para a caixa da loja e conferir se chega.
5. **Resend.** Clicar em Verify no domínio. Só segue quando estiver verificado.
6. **Vercel, variáveis.** `APP_URL=https://www.netshopgarden.com.br` (ou sem `www`, igual ao domínio principal escolhido na Vercel), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM`. Fazer o Redeploy.
7. **Cielo.** Trocar a URL de notificação para `https://<domínio>/api/webhooks/payments/cielo`, com o mesmo cabeçalho `webhooksecret`.
8. **Tarefas agendadas.** Com o plano Pro, aumentar a frequência de `expirar-pagamentos` e `carrinhos-abandonados` no `vercel.json` e publicar.
9. **Teste completo, ainda em manutenção e logado como equipe:**
   - criar uma conta com um e-mail seu e conferir o e-mail de boas-vindas;
   - comprar com Pix e pagar: o pedido muda para pago e o e-mail de confirmação chega;
   - comprar com cartão, cancelar com devolução;
   - abrir três endereços do site antigo e conferir que levam ao produto novo.
10. **Abrir a loja.** Admin > Configurações, desligar o modo manutenção.

## Depois de abrir

- Google Search Console: adicionar o domínio, enviar `https://<domínio>/sitemap.xml` e acompanhar os erros 404 (Admin > Redirecionamentos mostra os endereços não encontrados).
- Conferir os primeiros pedidos reais de ponta a ponta: e-mail, estoque, aviso de pagamento.
- Cancelar o contrato do site antigo só depois de uma semana sem problemas com o e-mail.

## Se algo der errado

- **Site fora do ar depois do DNS:** conferir o `A` e o `CNAME` na zona; o valor antigo do site era `201.20.10.204`.
- **E-mail da loja não chega:** conferir os quatro `MX` e os `CNAME` de e-mail na zona.
- **Pagamento com problema:** ligar o modo manutenção. Pedidos já pagos continuam válidos.
- **Pix pago e pedido ainda pendente:** a página do pedido consulta a Cielo sozinha enquanto está aberta; a tarefa `expirar-pagamentos` também consulta antes de expirar.
