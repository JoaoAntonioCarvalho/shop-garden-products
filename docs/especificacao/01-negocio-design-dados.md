# Especificação, parte 1: negócio, configuração, design e dados (seções 1, 5, 6, 7)

Transcrição condensada da especificação entregue pelo dono em 2026-10-03. Mantém todos os valores, nomes e regras. Em caso de dúvida, o original do dono prevalece.

## 1. Contexto do negócio

- Marca: **Net Shop Garden**, única grafia permitida.
- Parceira oficial de e-commerce do Shopping Garden (desde 1999, 3 lojas físicas em São Paulo, mais de 20 mil itens). Principal argumento de autoridade.
- Atendimento consultivo por WhatsApp (pedidos sob medida, arranjos exclusivos).
- Diferenciais visíveis na primeira tela: entrega no mesmo dia em São Paulo, embalagem especial para plantas e peças frágeis, curadoria do Shopping Garden, arranjos sob medida.
- Público: 52% SP, 15% RJ; 82% mulheres; decoração e presente; 95% pessoa física. No site antigo o comprador via em média 50 páginas (mediana 33) até comprar: reduzir esse esforço.
- Frente da loja: orquídeas, plantas naturais, arranjos, vasos e cachepots de cerâmica e porcelana, flores artificiais, presentes. Jardinagem fica no menu com destaque secundário e fora do hero.
- Proibido: argumento de preço baixo ("mais barato", "até 20% abaixo"); tom defensivo ("loja segura", "SSL", "100% protegidos"). Segurança só como selo discreto no checkout.
- Checklist dos problemas do site antigo (seção 1.4): está em `docs/PLANO.md`.

## 5. Configuração central (`src/config/store.config.ts`)

`getStoreSettings()` mescla o arquivo com a tabela `StoreSetting`, com cache e invalidação quando o admin salva. Valores de exemplo levam `// TODO(dono): confirmar`.

| Chave                        | Padrão                                                                     |
| ---------------------------- | -------------------------------------------------------------------------- |
| `name`                       | Net Shop Garden                                                            |
| `tagline`                    | Plantas, orquídeas e arranjos com curadoria Shopping Garden                |
| `legalName`                  | [RAZÃO SOCIAL]                                                             |
| `cnpj`                       | [00.000.000/0001-00]                                                       |
| `address`                    | [Endereço completo]                                                        |
| `whatsapp`                   | 5511955817159                                                              |
| `phoneDisplay`               | (11) 95581-7159                                                            |
| `email`                      | contato@netshopgarden.com.br                                               |
| `businessHours`              | Segunda a sexta, das 9h às 17h                                             |
| `instagram`                  | [URL]                                                                      |
| `partnerClaim`               | Parceira oficial de e-commerce do Shopping Garden, desde 1999 em São Paulo |
| `pixDiscountPercent`         | 5                                                                          |
| `maxInstallments`            | 6 (sem juros)                                                              |
| `minInstallmentCents`        | 3000                                                                       |
| `freeShippingThresholdCents` | 29900 (só entrega local Grande SP e econômica nacional)                    |
| `giftWrapPriceCents`         | 1500                                                                       |
| `sameDay.enabled`            | true                                                                       |
| `sameDay.cutoffTime`         | 14:00 (America/Sao_Paulo)                                                  |
| `sameDay.days`               | segunda a sábado                                                           |
| `sameDay.cepRanges`          | 01000-000 a 05999-999 e 08000-000 a 08499-999                              |
| `pixExpirationMinutes`       | 30                                                                         |
| `cartExpirationDays`         | 30                                                                         |
| `lowStockDefaultThreshold`   | 3                                                                          |
| `welcomeCoupon`              | BEMVINDO10 (10% na primeira compra)                                        |
| `legacyWelcomeCoupon`        | NETSHOPGARDENBEMVINDO                                                      |
| `holidays`                   | lista de datas sem entrega, editável no admin                              |

## 6. Identidade visual

### 6.1 Direção: "herbário contemporâneo"

Catálogo botânico impresso: fotografia grande, muito respiro, serifada editorial, detalhes de etiqueta de herbário. Proibido: eyebrows em caixa alta; destacar uma palavra do título com cor ou itálico; "→" em botões e links; metadados unidos por ponto médio; numerar seções que não são sequência (checkout pode); o mesmo card arredondado com sombra para tudo; gradientes decorativos; carrossel automático. Animação só como resposta a ação do usuário; no máximo um fade de entrada da imagem do hero; respeitar `prefers-reduced-motion`. O elemento memorável é a ficha botânica; o resto é silencioso.

### 6.2 Cores

| Token       | Hex     | Uso                                                                                  |
| ----------- | ------- | ------------------------------------------------------------------------------------ |
| `moss-900`  | #2F3221 | Faixa inferior do rodapé, títulos grandes com mais peso                              |
| `moss-700`  | #4D5236 | Principal: topo, rodapé, títulos, links, ícones, botões secundários                  |
| `moss-500`  | #6E7552 | Hover musgo, ícones secundários                                                      |
| `moss-100`  | #E7E8DC | Fundos suaves, chips selecionados                                                    |
| `wine-700`  | #9A1B1F | Ação: adicionar, finalizar, preço promocional, selos de desconto, contador da sacola |
| `wine-800`  | #7C1519 | Hover e pressionado do vinho                                                         |
| `wine-50`   | #F7EBEA | Fundo de erro e selo de promoção                                                     |
| `cream-50`  | #FBF8F2 | Fundo das páginas                                                                    |
| `cream-100` | #F3EDE1 | Seções alternadas, checkout, ficha botânica                                          |
| `white`     | #FFFFFF | Fotos de produto, campos, gavetas, modais                                            |
| `ink`       | #23251B | Texto principal                                                                      |
| `ink-muted` | #5F624F | Texto secundário                                                                     |
| `line`      | #DDD6C6 | Bordas                                                                               |
| `success`   | #4D5236 | Sempre com ícone                                                                     |
| `warning`   | #8A5A00 | Sempre com ícone                                                                     |
| `danger`    | #9A1B1F | Sempre com ícone e texto                                                             |

Nunca vinho sobre musgo nem musgo sobre vinho. Vinho com parcimônia (mais de três elementos vinho na tela: rever). Texto creme no rodapé musgo: conferir contraste. Teste unitário de contraste (mínimo 4.5:1) das combinações permitidas.

### 6.3 Tipografia

- Cormorant Garamond (500, 600, itálico 500): display, títulos, nome do produto, nome científico (itálico). Nunca abaixo de 22px.
- Inter (400, 500, 600): corpo, interface, preços com `tabular-nums`. Admin só Inter.
- Escala desktop/mobile/altura de linha: display 64/40/1.05; H1 48/34/1.1; H2 36/28/1.15; H3 26/22/1.2; corpo grande 18/17/1.6; corpo 16/16/1.6; pequeno 14/14/1.5; legenda 13/13/1.4.
- Sentence case em tudo. Linha de texto com no máximo 70 caracteres.

### 6.4 Grid e formas

12 colunas, largura máxima 1320px, margens 24px (mobile) e 48px (desktop). Escala de 4px. Seções da home com 96px (desktop) e 64px (mobile). Raio: 2px fotos, 6px botões e campos, 12px gavetas e modais. Sombra só em gavetas, modais e menus suspensos. Fotos de produto 4:5 em fundo branco.

### 6.5 Componentes da loja (todos em `/dev/design-system`, com estados padrão, hover, foco, desabilitado, carregando, erro)

- `Button`: `primary` (vinho), `secondary` (contorno musgo), `ghost` (texto musgo), `whatsapp` (musgo com ícone, sem o verde do WhatsApp); `sm`, `md`, `lg`; carregando com spinner e texto mantido para leitor de tela.
- `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `QuantityStepper`, `MaskedInput` (CPF, CEP, telefone, cartão, validade), `Field` (rótulo, ajuda, erro por `aria-describedby`).
- `Price` (atual, "de" riscado, Pix, parcelas; uma única função de cálculo).
- `Badge`: novo, promoção com percentual, entrega hoje, últimas unidades, esgotado, compra verificada.
- `Rating` (meia estrela, nota, contagem).
- `Breadcrumb`, `Pagination`, `Accordion`, `Tabs`, `Dialog`, `Drawer` (lateral no desktop, inferior no mobile), `Toast`, `Tooltip`, `Skeleton`, `EmptyState`, `Alert`.
- `ProductCard`, `ProductGrid`, `CategoryTile`, `BotanicalSheet`, `ShippingCalculator`, `CouponField`, `FreeShippingProgress`, `WhatsAppButton`, `NewsletterForm`.
- Ícones `lucide-react`, stroke 1.5, musgo ou cor do texto.
- Foco: contorno 2px `moss-700` com 2px de afastamento; em fundo musgo, contorno creme.

### 6.6 Ficha botânica

Retângulo `cream-100`, borda 1px `moss-700`, cantos retos, linha dupla no topo (duas de 1px com 3px de espaço), duas colunas.

- Plantas e orquídeas: nome popular (Cormorant 26px), nome científico (itálico 20px), luz (sol pleno, meia-sombra, sombra, luz indireta), rega em linguagem simples, porte na entrega (cm), ambiente (interno, externo, ambos), pet friendly (sim, não, "tóxico para pets" com alerta), nível de cuidado (fácil, moderado, exige atenção). Rodapé: "Curadoria Shopping Garden" e código do produto.
- Vasos, cachepots, decoração ("ficha técnica"): material, dimensões (altura × diâmetro da boca × diâmetro da base), capacidade em litros, furo de drenagem, uso interno/externo, peso, limpeza.
- Artificiais: material, dimensões, se acompanha vaso, limpeza ("passe pano seco ou secador no modo frio").
- Versão reduzida na legenda do hero (nome popular + científico).

## 7. Modelo de dados

Dinheiro `Int` em centavos. Ids `cuid()`. Índices em tudo que é filtrado ou buscado. Extensões `unaccent` e `pg_trgm` via migração. `createdAt`/`updatedAt` onde fizer sentido.

### 7.1 Usuários

- **User**: name, email (único, minúsculo), passwordHash, role (`CUSTOMER`, `STAFF`, `ADMIN`), phone, cpf (opcional, único, só dígitos), birthDate, emailVerifiedAt, marketingEmailOptIn (false), marketingWhatsappOptIn (false), optInAt, lastLoginAt, isSample, anonymizedAt.
- **Address**: userId, label, recipientName, recipientPhone, cep, street, number, complement, district, city, state, reference, isDefault.
- **PasswordResetToken**, **EmailVerificationToken**: userId, tokenHash, expiresAt, usedAt.
- **Wishlist**: userId + productId (chave composta), createdAt.
- **CustomerNote**: customerId, authorId, body.

### 7.2 Catálogo

- **Category**: name, slug (único por pai), path (único, ex. `vasos/ceramica`), parentId, description (até 200), seoTitle, seoDescription, seoContent (HTML), faq (JSON `{pergunta, resposta}`), imageId, position, isActive, showInMenu, showOnHome, isSecondary, legacyPaths, filtersConfig (JSON).
- **Collection**: name, slug, description, imageId, isActive, position, type (`MANUAL`, `RULE`), rule (JSON), produtos N:N com position.
- **Product**: name, slug (único), sku (pai, único), status (`DRAFT`, `ACTIVE`, `ARCHIVED`), productType (`NATURAL_PLANT`, `ORCHID`, `ARRANGEMENT`, `ARTIFICIAL`, `POT`, `CACHEPOT`, `DECOR`, `AROMA`, `GARDEN_TOOL`, `GARDEN_SUPPLY`), primaryCategoryId, categorias adicionais N:N, brand, shortDescription (até 160), description (HTML), careInstructions (HTML), tags, isFeatured, isNew, isGiftable, sameDayEligible, deliveryScope (`LOCAL_ONLY` para plantas vivas, orquídeas e arranjos naturais; `NATIONAL`), fragile, perishable, ficha botânica (commonName, scientificName, light, watering, environment, petSafety, careLevel, heightCm), técnicos (material, color, heightCm, widthCm, depthCm, mouthDiameterCm, baseDiameterCm, capacityLiters, hasDrainageHole, indoorOutdoor), seoTitle, seoDescription, relatedProductIds, ratingAverage, ratingCount, salesCount30d, isSample, publishedAt.
- **ProductVariant**: productId, name, sku (único), options (JSON), priceCents, compareAtPriceCents, costCents (só ADMIN), promoPriceCents, promoStartsAt, promoEndsAt, stockOnHand, stockReserved, lowStockThreshold, weightGrams, barcode, isActive, position. Todo produto tem ao menos uma variante. Disponível = stockOnHand − stockReserved.
- **MediaAsset**: originalName, storageKey, mimeType, sizeBytes, width, height, alt, blurDataUrl, variants (JSON com 400, 800, 1600 WebP), uploadedById, isSample.
- **ProductImage**: productId, variantId (opcional), mediaId, position, isCover.
- **InventoryMovement**: variantId, type (`IN`, `OUT`, `ADJUSTMENT`, `SALE`, `RESERVE`, `RELEASE`, `RETURN`, `LOSS`), quantity (±), stockOnHandAfter, stockReservedAfter, reason, orderId, userId.

### 7.3 Carrinho, pedidos, pagamentos

- **Cart**: token (cookie httpOnly), userId, email, couponCode, giftMessage, giftWrap, recipientName, utm (JSON), status (`ACTIVE`, `CONVERTED`, `ABANDONED`), lastActivityAt, expiresAt.
- **CartItem**: cartId, variantId, quantity, addedAt. Sem preço guardado.
- **Order**: number (`NSG-000123`, sequência do Postgres), accessToken, userId, customerName, customerEmail, customerPhone, customerCpf, shippingAddress (JSON), billingAddress (JSON), recipientName, recipientPhone, status, paymentStatus, paymentMethod (`PIX`, `CREDIT_CARD`, `BOLETO`, `MANUAL`), installments, subtotalCents, discountCents, pixDiscountCents, shippingCents, giftWrapCents, totalCents, couponId, couponCode, shippingMethodCode, shippingMethodName, deliveryDate, deliveryWindow, estimatedDeliveryFrom, estimatedDeliveryTo, trackingCode, carrier, giftMessage, giftWrap, customerNotes, internalNotes, channel (`SITE`, `WHATSAPP`, `STORE`, `PHONE`), utmSource, utmMedium, utmCampaign, utmContent, referrer, idempotencyKey (único), isSample, paidAt, preparedAt, shippedAt, deliveredAt, canceledAt, cancelReason.
- **OrderItem**: orderId, variantId, productId, snapshots (productName, variantName, sku, imageUrl, unitPriceCents, compareAtPriceCents), quantity, totalCents.
- **OrderStatusHistory**: orderId, fromStatus, toStatus, note, notifiedCustomer, userId (nulo = sistema).
- **Payment**: orderId, provider, method, status (`PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `EXPIRED`, `REFUNDED`, `CANCELED`), amountCents, installments, externalId, pixPayload, pixQrCodeDataUrl, pixExpiresAt, boletoLine, boletoUrl, boletoDueDate, cardBrand, cardLast4, failureReason, rawResponse (JSON). Nunca número completo, validade ou CVV.
- **Refund**: paymentId, amountCents, reason, status, userId.

### 7.4 Promoções, avaliações, conteúdo, marketing

- **Coupon**: code (único, maiúsculo), description, type (`PERCENT`, `FIXED`, `FREE_SHIPPING`), value, minSubtotalCents, maxDiscountCents, usageLimit, usageCount, perCustomerLimit, firstPurchaseOnly, startsAt, endsAt, isActive, categorias e produtos N:N, combinableWithPix (true).
- **CouponRedemption**: couponId, orderId, userId ou email.
- **Review**: productId, userId, orderId, authorName, authorCity, rating (1–5), title, body, status (`PENDING`, `APPROVED`, `REJECTED`), isVerifiedPurchase, adminReply, repliedAt, isSample.
- **Testimonial**: authorName, authorCity, rating, body, source (site, Google, WhatsApp), isPublished, position.
- **Banner**: placement (`HOME_HERO`, `HOME_SECONDARY`, `CATEGORY_TOP`, `TOP_BAR`), title, subtitle, ctaLabel, ctaUrl, ctaType (`LINK`, `WHATSAPP`), whatsappMessage, imageDesktopId, imageMobileId, imageCaption, categoryId, startsAt, endsAt, isActive, position, utmCampaign.
- **HomeSection**: type (`BESTSELLERS`, `COLLECTION`, `CATEGORY`, `MANUAL`, `NEW_ARRIVALS`, `OCCASIONS`, `TESTIMONIALS`, `HERITAGE`, `NEWSLETTER`, `SECONDARY_CATEGORY`), title, subtitle, sourceId, productIds, limit, position, isActive.
- **Occasion**: name, slug, description, imageId, tag, position.
- **Page**: slug, title, content (HTML), seoTitle, seoDescription, isPublished, showInFooter, footerGroup.
- **FaqItem**: question, answer, group, position, isPublished.
- **Lead**: email, name, whatsapp, source (`POPUP`, `FOOTER`, `CHECKOUT`, `ACCOUNT`, `PRODUCT_REQUEST`, `CONTACT`), consentText, consentAt, ipHash, utm (JSON), couponIssued, confirmedAt, unsubscribedAt, isSample.
- **ProductRequest**: name, email, whatsapp, description, budgetRange, imageId, status (`NEW`, `IN_PROGRESS`, `QUOTED`, `CLOSED`), assignedToId, internalNotes.
- **ContactMessage**: name, email, phone, subject, message, orderNumber, status.

### 7.5 Frete

- **ShippingRule**: name, code, method (`SAME_DAY`, `LOCAL_SCHEDULED`, `NATIONAL_ECONOMY`, `NATIONAL_EXPRESS`, `PICKUP`), cepStart, cepEnd, baseFeeCents, feePerKgCents, freeAboveCents, minDays, maxDays, cutoffTime, weekdays, allowsLocalOnlyProducts, isActive, position.
- **DeliverySlot** (opcional): date, window, capacity, booked.
- **Holiday**: date, name.

### 7.6 Sistema

- **StoreSetting**: key (único), value (JSON), updatedById.
- **Redirect**: fromPath (único, normalizado), toPath, statusCode (301), hits, lastHitAt, isActive, note.
- **NotFoundLog**: path, hits, lastHitAt.
- **SearchLog**: termo normalizado, quantidade de resultados, contagem.
- **AuditLog**: userId, action (ex. `product.update`), entityType, entityId, diff (JSON antes/depois), ipHash, userAgent.
- **EmailLog**: to, subject, template, payload (JSON), status (`SENT`, `FAILED`), error, orderId.
- **DataRequest**: userId, email, type (`EXPORT`, `DELETE`), status (`OPEN`, `DONE`, `REJECTED`), handledById, resolvedAt.
- **JobRun**: name, startedAt, finishedAt, status, summary.
