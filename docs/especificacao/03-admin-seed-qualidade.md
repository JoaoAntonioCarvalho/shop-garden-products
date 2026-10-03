# Especificação, parte 3: admin, seed, SEO, analytics, segurança, qualidade e entrega (seções 12 a 21)

## 12. Painel administrativo (`/admin`)

### 12.1 Estrutura

- Barra lateral recolhível agrupada em Vendas, Catálogo, Clientes, Marketing, Conteúdo, Configurações. Cabeçalho com busca global (pedido por número; cliente por nome, e-mail, CPF; produto por nome, SKU), "Ver loja", menu do usuário.
- shadcn/ui com tokens da marca. Branco e `cream-50`; musgo na navegação ativa e botões principais; vinho só para destrutivo e alertas. Só Inter. Densidade alta.
- Utilizável em tablet e funcional no celular (pedidos e estoque, para a expedição).
- Listas: busca, filtros, ordenação e paginação no servidor; filtros na URL; seleção múltipla; exportação CSV do filtrado, auditada.
- Formulários: Zod, aviso de alterações não salvas, toast com o nome da ação ("Produto salvo", "Status alterado para Em preparação").
- Destrutivo pede confirmação com o nome do item.
- `docs/ADMIN-MANUAL.md` em linguagem simples.

### 12.2 Permissões (`can(user, 'orders.refund')` em `src/lib/permissions.ts`, usada na interface e no servidor)

| Módulo                                                                | ADMIN                              | STAFF                                                              |
| --------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Dashboard                                                             | Completo, com custo e margem       | Sem custo e margem                                                 |
| Pedidos                                                               | Tudo                               | Ver, status, rastreio, notas, imprimir, pedido manual. Sem estorno |
| Produtos, categorias, coleções, mídia                                 | Tudo                               | Ver e editar estoque e imagens. Sem excluir e sem alterar preço    |
| Estoque                                                               | Tudo                               | Tudo, menos valor em estoque                                       |
| Clientes                                                              | Tudo, inclui exportar e anonimizar | Ver e notas. Sem exportar                                          |
| Cupons, banners, home, páginas, avaliações, leads, solicitações       | Tudo                               | Avaliações, solicitações e leads (sem exportar)                    |
| Frete, configurações, usuários, redirecionamentos, auditoria, e-mails | Tudo                               | Sem acesso                                                         |

### 12.3 Dashboard

- Período: hoje, ontem, 7 dias, 30 dias, mês atual, mês anterior, personalizado; comparação com o período anterior (%).
- Indicadores: faturamento (pagos), pedidos pagos, ticket médio, itens vendidos, aguardando pagamento (e valor), taxa de aprovação, novos clientes, novos leads, carrinhos abandonados (e valor).
- Gráficos: faturamento por dia (linha, anterior tracejado); pedidos por método de pagamento; vendas por canal; por origem UTM; faturamento por categoria principal (barras horizontais).
- Tabelas: 10 produtos mais vendidos; 10 melhores clientes.
- **Entregas de hoje**: pedidos com entrega hoje ou agendada para hoje, endereço resumido, período, status, botão de avançar.
- **Atenção agora**: Pix perto de expirar, pagos há mais de 24h sem preparo, estoque baixo ou zerado, avaliações pendentes, solicitações novas, contatos não lidos, pedidos LGPD abertos.
- ADMIN: margem bruta estimada.

### 12.4 Pedidos

- Lista: número, data, cliente, total, pagamento, status, entrega, canal, origem; selos.
- Filtros: status, status e método de pagamento, método de entrega, canal, datas de criação e entrega, "entrega hoje", "atrasados", cupom, faixa de valor, busca.
- Em massa: status (inválidos listados e ignorados), listas de separação, CSV.
- Detalhe: ações por status ("Marcar como pago", "Iniciar preparação", "Marcar como enviado" com transportadora e rastreio, "Saiu para entrega", "Marcar como entregue", "Cancelar pedido" com motivo, estorno e devolução ao estoque); linha do tempo (status, pagamentos, e-mails, notas); itens com estoque atual; cliente, CPF mascarado com "Mostrar" auditado; endereço com "Copiar endereço" e mapa; destinatário, cartão e embalagem em destaque; pagamento e estorno (ADMIN); valores; UTM e canal; notas internas; "Reenviar e-mail"; impressões com CSS de impressão: lista de separação, etiqueta de envio, cartão de presente em A6.
- **Pedido manual** (`/admin/pedidos/novo`): cliente existente ou novo; produtos com busca e estoque; preço unitário ajustável com motivo (ADMIN); cupom; entrega com cálculo ou valor manual; pagamento ("Pix já recebido", "Gerar Pix", "Cartão na maquininha", "Dinheiro", "Link de pagamento"); canal (WhatsApp padrão) e origem; observações. Reserva e baixa estoque e entra nos relatórios. "Enviar resumo e link de pagamento ao cliente por e-mail".

### 12.5 Produtos

- Lista: foto, nome, SKU, categoria, preço (faixa), estoque, status, qualidade, selo "Teste".
- Filtros: status, categoria, tipo, estoque (sem, baixo, ok), sem imagem, sem descrição, qualidade abaixo de X, de teste, em promoção.
- Edição rápida de preço e estoque da variante padrão.
- Em massa: publicar, arquivar, mover de categoria, adicionar a coleção, tags, reajuste em % com prévia, "Entrega hoje", excluir (só sem pedidos; senão arquivar).
- **"Remover todos os produtos de teste"**: confirmação digitada "REMOVER TESTES"; apaga produtos, variantes, imagens, avaliações, pedidos, clientes e leads `isSample`, em transação, com relatório.
- Duplicar (rascunho com "(cópia)").
- Formulário em abas, salvar fixo, abas com erro indicadas: 1 Geral (nome, slug com aviso e redirecionamento automático ao mudar publicado, tipo, status, categorias, coleções, marca, tags, descrição curta com contador de 160, descrição e cuidados em editor rico, flags). 2 Variações (opções e combinações; tabela com SKU, preço, "de", custo ADMIN, promoção com datas, peso, estoque, alerta, código de barras, ativo). 3 Imagens (arrastar e soltar, JPG/PNG/WebP até 10 MB, progresso, reordenar por arrastar e por botões, capa, imagem por variante, alt obrigatório para publicar, biblioteca). 4 Ficha botânica/técnica com prévia ao vivo. 5 Entrega (hoje, escopo, frágil, perecível, peso, dimensões). 6 SEO (contadores e prévia do Google). 7 Relacionados. 8 Histórico (auditoria e estoque).
- **Qualidade de cadastro** 0–100 com checklist: 3 ou mais imagens; todas com alt; descrição com mais de 300 caracteres que não seja só a frase padrão de envio; descrição curta; ficha completa; peso e dimensões; SEO; categoria. Publicar abaixo de 60 pede confirmação.
- **Importação CSV** (`/admin/produtos/importar`): formato FastCommerce (`NomeCat`, `CodProd`, `NomeProd`, `Peso`, `Descricao`, `DescrLonga`, `Preco`, `PrecoProm`, `DataPromInicio`, `DataPromFim`, `Estoque`, `Disponivel`, `IDProdutoPai`...; separador `,` ou `;`; decimal com vírgula; ISO-8859-1 ou UTF-8 detectado) e formato próprio ("Baixar modelo CSV"). Etapas: enviar → mapear colunas → mapear categorias → prévia com validação por linha → importar como rascunho ou publicado → relatório. Em lotes.
- **Exportação CSV** no formato próprio.

### 12.6 Categorias e coleções

Árvore com arrastar (ordem e pai), ativar, menu, home, secundária. Formulário: nome, slug, pai, descrição, imagem, texto de SEO, FAQ, filtros, URLs antigas, SEO com prévia. Mudar slug publicado cria redirecionamentos (inclui subcategorias). Coleções manuais (escolher e ordenar) ou por regra (tags, categoria, novidade, mais vendidos, promoção).

### 12.7 Estoque

Tabela por variante (foto, produto, variante, SKU, em estoque, reservado, disponível, alerta, status, última movimentação). Filtros: categoria, status, com reserva, de teste. Ajuste rápido: "Entrada", "Saída", "Ajuste de inventário", "Perda/quebra" com quantidade e motivo. Entrada em lote (`SKU;quantidade;motivo`, prévia). Contagem de inventário por categoria com diferenças antes de aplicar. Histórico com filtros e exportação. Valor em estoque (ADMIN). E-mail diário de estoque baixo e contador no menu.

### 12.8 Mídia

Grade com busca, filtros "sem texto alternativo", "não utilizadas", "de teste". Upload múltiplo; tipo real pelo conteúdo, limite, remoção de EXIF, WebP 400/800/1600, `blurDataUrl`. Detalhe: prévia, dimensões, tamanho, alt, onde é usada, copiar URL. Exclusão bloqueada se em uso. Providers: `local` (`./uploads`, servido em `/media/[...key]` com cache longo) e `s3`.

### 12.9 Clientes

Lista: nome, e-mail, telefone, cidade/UF, pedidos, total gasto, último pedido, consentimento, cadastro. Filtros: com ou sem pedidos, faixa de gasto, último pedido há mais de X dias, UF, consentimento, aniversariantes. Ficha: dados, endereços, pedidos, total, ticket, mais comprados, avaliações, consentimentos, notas, auditoria. Ações: editar, redefinir senha, alterar papel (ADMIN), anonimizar, exportar. Exportação da lista (ADMIN) auditada com aviso.

### 12.10 Carrinhos abandonados

Carrinhos identificados, itens, valor, última atividade, sem pedido nas últimas 2 horas. "Enviar e-mail de recuperação" (link que restaura), "Copiar mensagem de WhatsApp", marcar como contatado. Valor total e taxa de recuperação.

### 12.11 Cupons

Lista; formulário com as regras da 9.2 e prévia em linguagem simples ("10% de desconto, válido na primeira compra, a partir de R$ 100, até 30/11/2026"); relatório por cupom; gerador em lote de cupons únicos com exportação.

### 12.12 Avaliações e depoimentos

Fila com filtros; aprovar, rejeitar (motivo interno), responder, editar só erros de digitação (registrado). "Solicitar avaliação" em pedidos entregues. Depoimentos: criar, editar, ordenar, publicar.

### 12.13 Marketing e conteúdo

- Banners: por posição com prévia; título, subtítulo, botão (link ou WhatsApp), imagens (2400×1050 e 1200×1500), legenda botânica, agendamento, UTM, ativo; prévia ao vivo com aviso de contraste baixo.
- Home: seções com arrastar, ativar, fonte, título; "Ver prévia".
- Barra superior: três mensagens.
- Ocasiões; páginas (editor, SEO, publicar, rodapé e grupo); FAQ.
- Leads (`/admin/leads`): e-mail, nome, WhatsApp, origem, consentimento, confirmado, cupom, já comprou, UTM; exportação (ADMIN, auditada) só com consentimento ativo; conversão.
- Solicitações e contatos: caixa de entrada com status, responsável, notas, "Responder pelo WhatsApp" ou e-mail.
- Avise-me: por produto; ao repor, disparar "Chegou".

### 12.14 Frete (`/admin/frete`)

Regras editáveis, feriados, capacidade por período (opcional), **simulador** (CEP + carrinho de exemplo).

### 12.15 Configurações

Dados da loja; regras comerciais; entrega hoje; integrações (somente leitura, "Modo simulado", link para a documentação); analytics; e-mails (remetente, destinatário interno, "Enviar e-mail de teste"); modo manutenção ("Voltamos em breve"). Tudo auditado e invalida o cache.

### 12.16 Usuários

Listar, convidar (link para definir senha), papel, desativar. Não remover o último ADMIN.

### 12.17 Redirecionamentos e 404

Lista (origem, destino, código, acessos, último acesso, ativo); criar, editar, importar CSV, testar URL. Aba "Páginas não encontradas" com "Criar redirecionamento". Validação contra loops e cadeias.

### 12.18 Relatórios (período, gráfico, CSV)

Vendas por dia, semana e mês; por produto, variante e categoria (margem para ADMIN); por canal e origem UTM (inclui manuais do WhatsApp); por método de pagamento e aprovação; por método de entrega e região; cupons; clientes (novos e recorrentes, recompra, valor médio); leads por origem e conversão; buscas (mais buscados e sem resultado); estoque (giro, parados, valor); cadastro incompleto (qualidade abaixo de 60).

### 12.19 Auditoria, e-mails, tarefas

- `/admin/auditoria` (ADMIN): usuário, ação, entidade com link, data, IP em hash, diferenças; filtros.
- `/admin/emails` (ADMIN): `EmailLog`, ver conteúdo, reenviar.
- `/admin/tarefas` (ADMIN): expirar Pix e boleto, atualizar vendas de 30 dias, marcar carrinhos abandonados, resumo de estoque baixo, limpar carrinhos expirados; última execução, status, "Executar agora". Route handlers `/api/cron/[tarefa]` com `CRON_SECRET`. README explica o agendamento.

## 13. Seed (idempotente, `upsert` por slug, SKU, e-mail; menos de 2 minutos)

1. Configurações. 2. ADMIN (do ambiente) e STAFF `expedicao@example.com`. 3. Categorias com descrição, SEO, FAQ, imagem, URLs antigas. 4. Coleções. 5. Redirecionamentos. 6. Regras de frete e feriados nacionais do ano corrente e do próximo.
2. Produtos de teste: mínimo 4 por subcategoria e 2 em cada principal (~150), `isSample`, SKU `TESTE-`, `ACTIVE`, ~30% com variantes. Nome realista, descrição útil de 300 a 600 caracteres, descrição curta, cuidados, ficha completa, peso, dimensões, 2 a 4 imagens, tags de ocasião, `deliveryScope` e `sameDayEligible` coerentes.
3. Estoque: maioria 5 a 40; 8 variantes baixas; 4 zeradas; 10% em promoção; 15% novos.
4. 80 clientes (`@faker-js/faker` pt_BR, `@example.com`, CPF válido; ~50% capital SP, 15% Grande SP, 15% RJ, resto outros). `cliente@example.com` com senha no README.
5. ~250 pedidos em 120 dias, mais volume em datas comemorativas, status coerentes com a idade, ~55% Pix, 40% cartão, 5% boleto; ~80% site, 20% WhatsApp; UTM (google/organic, google/cpc, instagram/social, whatsapp, email/newsletter, direct); alguns com cupom, entrega hoje, presente. Pelo menos 3 com entrega hoje. Movimentos de estoque.
6. ~120 avaliações (maioria 4 e 5), 10 pendentes, algumas com resposta.
7. 6 depoimentos (nome e inicial, cidade).
8. Cupons: `BEMVINDO10`; `NETSHOPGARDENBEMVINDO`; `FRETEGRATIS` (acima de R$ 150, Grande SP); `PRIMAVERA15` (15% em plantas naturais, ativo); um expirado; um esgotado.
9. Banners: hero com 2 slides, barra superior, 1 em Orquídeas. 15. Seções da home. 16. Ocasiões. 17. Páginas e FAQ. 18. 120 leads. 19. 5 solicitações e 5 contatos. 20. 10 carrinhos abandonados com e-mail. 21. Buscas, algumas sem resultado.

### 13.2 Produtos por categoria (nomes base e faixa de preço)

| Categoria                    | Exemplos                                                                                                                                                                                                                          | Faixa        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Orquídeas                    | Phalaenopsis branca 2 hastes; Phalaenopsis rosa em cachepot de cerâmica; Cymbidium; Dendrobium; Mini Phalaenopsis                                                                                                                 | R$ 89–390    |
| Plantas ornamentais          | Zamioculca; Costela-de-adão; Espada-de-são-jorge; Jiboia em cachepot; Lírio-da-paz; Pacová                                                                                                                                        | R$ 49–320    |
| Flores em vasos              | Kalanchoe; Antúrio vermelho; Violeta; Begônia; Mini rosa                                                                                                                                                                          | R$ 29–129    |
| Cactos e suculentas          | Kit 3 suculentas em vasos de cerâmica; Cacto mandacaru; Echeveria; Composição em bandeja                                                                                                                                          | R$ 25–189    |
| Ervas e temperos             | Manjericão; Alecrim; Hortelã; Kit horta de temperos                                                                                                                                                                               | R$ 19–99     |
| Caixarias                    | Caixa de madeira com mix de suculentas; Caixote com ervas                                                                                                                                                                         | R$ 79–249    |
| Arranjos                     | Arranjo de orquídeas em centro de mesa; Arranjo tropical; Arranjo com rosas e folhagens                                                                                                                                           | R$ 180–1.100 |
| Arranjos artificiais         | Centro de mesa com suculentas artificiais; Vaso de cerâmica com Cymbidium artificial; Xícara com rosas artificiais; Centro de mesa com orquídea dourada                                                                           | R$ 150–1.150 |
| Vasos cerâmica e barro       | Vaso de barro tradicional; Cerâmica vitrificada verde-musgo; Esmaltado azul                                                                                                                                                       | R$ 29–450    |
| Vasos porcelana              | Porcelana branca canelado; Porcelana com borda dourada                                                                                                                                                                            | R$ 69–380    |
| Vasos vidro                  | Vidro para pendurar círculo 18 × 8 cm; para pendurar coração 18 × 23 cm; cilíndrico                                                                                                                                               | R$ 39–220    |
| Fibra de coco                | Vaso redondo; Placa para jardim vertical                                                                                                                                                                                          | R$ 19–89     |
| Plástico                     | Vaso redondo com prato; Jardineira                                                                                                                                                                                                | R$ 9–79      |
| Polietileno e reciclados     | Polietileno grande para área externa; Material reciclado                                                                                                                                                                          | R$ 89–690    |
| Vasos decorativos            | Vidro Murano; Cerâmica texturizada                                                                                                                                                                                                | R$ 79–690    |
| Acessórios para vasos        | Prato para vaso; Suporte de ferro; Gancho dourado P, M e G (variantes)                                                                                                                                                            | R$ 9–149     |
| Cachepots                    | Cerâmica mosaico; Alumínio escovado; Madeira de demolição; Cestaria natural; Autoirrigável; Vidro; Porcelana; Plástico fosco                                                                                                      | R$ 29–420    |
| Plantas e flores artificiais | Folhagem costela-de-adão; Orquídea de toque real; Planta em vaso grande                                                                                                                                                           | R$ 49–890    |
| Buquês                       | Rosas artificiais; Peônias artificiais                                                                                                                                                                                            | R$ 59–290    |
| Vasos com flores artificiais | Vaso de vidro com rosas; Cachepot com lavanda                                                                                                                                                                                     | R$ 89–480    |
| Objetos de decoração         | Porta-velas de vidro e ferro 5 × 11 cm e 9 × 10 cm; Bandeja decorativa; Terrário de vidro                                                                                                                                         | R$ 29–290    |
| Aromas L'Envie               | Difusor de varetas; Home spray; Vela aromática (variantes de fragrância)                                                                                                                                                          | R$ 49–189    |
| Linha Conceito               | Escultura de cerâmica; Vaso escultural                                                                                                                                                                                            | R$ 149–890   |
| Jardinagem                   | Tesoura de poda; Pá; Garfo; Luvas; Adubo NPK 10-10-10; Adubo orgânico; Substrato para orquídeas; para suculentas; Terra vegetal; Óleo de neem; Regador 5 L; Pulverizador 1 L; Mangueira 15 m; Argila expandida; Manta de drenagem | R$ 12–189    |

### 13.3 Imagens placeholder

Sem imagens da internet. `scripts/generate-placeholders.ts` com `sharp`: 1600 × 2000 WebP, fundo creme ou branco, ilustração em linha (SVG do script) por tipo (folha, orquídea, vaso, cachepot, flor, cacto, ferramenta, vela) em `moss-700`, nome do produto pequeno na base e "Imagem de teste". Variar composição e tom entre imagens do mesmo produto. Também hero (2400 × 1050 e 1200 × 1500), categorias e ocasiões. Todas `MediaAsset` com `isSample` e alt descritivo. Pendência do dono: fotos reais (fundo branco, luz natural, 4:5, uma foto em ambiente por produto de destaque).

## 14. SEO

`generateMetadata` ("Nome da página | Net Shop Garden", descrição, canonical, Open Graph, Twitter). Imagens OG com `next/og` (creme, serif, faixa musgo) para home, categorias e institucionais; produto usa a capa. `sitemap.ts` dinâmico com `lastModified`, dividido acima de 5.000 URLs. `robots.ts` bloqueia `/admin`, `/conta`, `/checkout`, `/carrinho`, `/pedido`, `/api`, `/busca` e filtros; fora de produção bloqueia tudo. JSON-LD: `Organization` com `sameAs`, `WebSite` com `SearchAction`, `Product`, `BreadcrumbList`, `FAQPage`, `Store`/`LocalBusiness` em Sobre. URLs em minúsculas, sem acento e sem barra final (normalizar). Um H1. Paginação com URL própria e canonical próprio. Alt obrigatório.

## 15. Analytics

`track(evento, dados)` em `src/lib/analytics/events.ts` → `dataLayer` e, com consentimento, `gtag` e `fbq`; sem IDs, console em dev. Eventos GA4 com itens (`item_id` = SKU, `item_name`, `item_category`, `item_variant`, `price` em reais, `quantity`): `view_item_list`, `select_item`, `view_item`, `add_to_wishlist`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase` (uma vez, `transaction_id` = número), `search`, `generate_lead` (origem), `whatsapp_click` (flutuante, produto, hero, checkout, pedido), `sign_up`, `login`. UTM: o proxy lê `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid` e grava cookie de 30 dias (último clique não direto), que segue para carrinho, pedido e lead. Scripts com `next/script` só após consentimento. Documentar (sem implementar) API de Conversões da Meta e Google Ads.

## 16. Segurança e LGPD

- bcrypt custo 12; nunca logar senha. Cabeçalhos: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Cookies `httpOnly`, `secure` em produção, `sameSite=lax`.
- Rate limit: login, criação de conta, recuperação de senha, rastreio, formulários públicos, busca. Interface trocável (`TODO(integracao)` Redis/Upstash).
- Honeypot e tempo mínimo nos formulários públicos. Sanitizar HTML ao salvar e ao renderizar. Upload validado pelo conteúdo, sem EXIF, nome gerado. IP só em hash com sal. Segredos nunca `NEXT_PUBLIC_`.
- LGPD: consentimento separado para e-mail e WhatsApp, nunca pré-marcado, com texto, data e origem; descadastro em um clique por token; double opt-in; políticas modelo (dados, finalidade, base legal, compartilhamento, retenção, encarregado); exportação e exclusão com fila no admin; exportações só ADMIN e auditadas; CPF mascarado.

## 17. Performance e acessibilidade

- Lighthouse mobile em produção (home, categoria, produto): Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 95. LCP < 2,5s, CLS < 0,1, INP < 200ms.
- Cache com tags (`product:[id]`, `category:[id]`, `home`, `settings`) invalidado pelo admin. `next/image` com `sizes`, blur, prioridade só no LCP. Fontes com `display: swap`. Recharts, Tiptap e TanStack Table só no admin, com import dinâmico. Sem N+1; listagem com até 3 consultas. Bundle analyzer com números em `docs/DECISOES.md`.
- WCAG 2.2 AA: teclado completo, "Pular para o conteúdo", foco preso e devolvido, Esc; rótulos visíveis, erros associados e anunciados (`aria-live`), resumo de erros; alt significativo; nada só por cor; toque 44 × 44; `prefers-reduced-motion`; `@axe-core/playwright` sem violações sérias ou críticas.

## 18. Testes

### Unitários

Preços (promoção por data, Pix com arredondamento, parcelas, percentual); cupons (cada regra e Pix); frete (faixas, corte no fuso de SP, feriados, itens locais, grátis); máquina de estados (válidas e inválidas); estoque (reserva, baixa, liberação, devolução, concorrência no Postgres de teste); validadores (CPF, CEP, telefone, cartão); slug e normalização de URL; contraste; templates de e-mail; permissões.

### E2E (Playwright)

1. Home → categoria → filtro → produto → variante → frete → sacola.
2. Convidado com Pix: entrega hoje (horário simulado antes do corte), simulador, "Pagamento aprovado", e-mail no Mailpit (API), estoque diminui.
3. Cartão recusado (0002) e nova tentativa aprovada (0000).
4. Cupom inválido com a mensagem certa; cupom válido aplica.
5. Produto local com CEP de outro estado: aviso e bloqueio do nacional.
6. Criar conta, login, carrinho mesclado, endereço, pedido na conta, baixar dados.
7. Admin cria produto com variante e imagem, publica, aparece na loja.
8. Admin leva pedido de "Pago" a "Entregue" com rastreio; histórico registra.
9. Pedido manual com canal WhatsApp aparece no relatório por canal.
10. STAFF bloqueado em configurações e exportação de clientes (interface e servidor).
11. `/decoracao/orquideas-naturais-86355227` → 301 → `/categoria/plantas-naturais/orquideas`.
12. Pop-up de lead captura com consentimento, mostra o cupom, não reaparece na sessão.
13. axe em home, categoria, produto, sacola, checkout, conta, dashboard do admin.

CI opcional em `.github/workflows/ci.yml` com Postgres.

## 19. Documentação final

`README.md` (visão geral, requisitos, subir em até 5 comandos, logins de teste, cartões de teste, simulador, Mailpit, scripts, remover testes, deploy em Vercel + Postgres gerenciado + S3/R2 + SMTP, tarefas agendadas); `docs/ARQUITETURA.md` (módulos, fluxo do pedido, providers); `docs/INTEGRACOES.md` (gateway, frete real, e-mail, armazenamento, nota fiscal, WhatsApp Business API); `docs/ADMIN-MANUAL.md`; `docs/PENDENCIAS-DO-DONO.md` (dados da empresa, contatos, regras comerciais, textos, logo e fotos, decisões, integrações); `DECISOES.md` e `PLANO.md` atualizados.

## 20. Critérios de aceite

Lista completa em `docs/PLANO.md`.

## 21. Fora do escopo

Gateway real; cotação real, etiquetas e rastreio automático; nota fiscal; mensagens automáticas pela API do WhatsApp Business; e-mail marketing em massa; marketplace; aplicativo; fidelidade e assinaturas. Deixar preparado e documentado em `docs/INTEGRACOES.md`.
