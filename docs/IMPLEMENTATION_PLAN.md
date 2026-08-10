# Plano de Implementação — Vancod Ofertas

## 1. Arquitetura

```text
Marketplaces
  ├─ Shopee Connector
  ├─ AliExpress Connector
  ├─ Amazon Connector
  ├─ Mercado Livre Connector
  └─ Magalu Connector
          |
          v
     Ingestion Layer
          |
          v
       Normalizer
          |
          v
       PostgreSQL
          |
          +--> Price History
          |
          v
      Offer Engine
       |   |   |
       |   |   +--> Deduplication
       |   +------> Quality Score
       +----------> Affiliate Link
          |
          v
       AI Worker
          |
          v
    Telegram Publisher
          |
          v
      Analytics
```

## 2. Monorepo

```text
vancod-ofertas/
├── apps/
│   ├── web/
│   ├── api/
│   ├── worker/
│   └── telegram-bot/
├── packages/
│   ├── database/
│   ├── types/
│   ├── config/
│   ├── logger/
│   ├── affiliate-core/
│   └── ai/
├── connectors/
│   ├── shopee/
│   ├── aliexpress/
│   ├── amazon/
│   ├── mercadolivre/
│   └── magalu/
├── docs/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

## 3. Contrato de Connector

Todo connector deve implementar uma interface conceitual:

```ts
interface MarketplaceConnector {
  name: string;
  healthCheck(): Promise<ConnectorHealth>;
  searchProducts(input: SearchInput): Promise<NormalizedProduct[]>;
  getProduct(id: string): Promise<NormalizedProduct | null>;
  getOffers(input: OfferQuery): Promise<NormalizedOffer[]>;
  createAffiliateLink?(input: AffiliateLinkInput): Promise<AffiliateLinkResult>;
}
```

O connector não deve vazar detalhes específicos do marketplace para o domínio.

## 4. Modelo normalizado

```ts
type NormalizedProduct = {
  marketplace: string;
  externalId: string;
  title: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  productUrl: string;
  rating?: number;
  reviewCount?: number;
};

type NormalizedOffer = {
  marketplace: string;
  externalProductId: string;
  price: number;
  currency: string;
  oldPrice?: number;
  discountPercent?: number;
  availability?: string;
  seller?: string;
  affiliateUrl?: string;
  capturedAt: string;
};
```

## 5. Offer Engine

### Regras

1. Validar preço atual.
2. Comparar com histórico próprio.
3. Calcular desconto observado.
4. Detectar alteração anormal de preço.
5. Deduplicar.
6. Calcular score.
7. Aplicar regras de publicação.

### Score inicial

- desconto real: 30
- histórico: 20
- preço absoluto: 15
- avaliação: 10
- volume/popularidade: 10
- comissão: 5
- popularidade: 5
- frete/condição logística quando disponível: 5

Total: 100.

Configurar pesos no banco/config para futura calibração.

### Faixas

- >= 85: auto-publicação, se todas as regras de segurança passarem.
- 70-84: revisão manual.
- < 70: rejeitar.

Esses valores são iniciais e devem ser calibrados por dados reais.

## 6. Histórico

Salvar snapshots periódicos.

Campos mínimos:

- product_id
- price
- old_price
- currency
- captured_at
- source_timestamp quando disponível

Calcular:

- menor preço 7d
- menor preço 30d
- menor preço 90d
- média 30d
- preço atual vs. histórico

## 7. IA

A IA recebe somente dados estruturados verificados.

Saída obrigatoriamente estruturada:

```json
{
  "headline": "...",
  "body": "...",
  "cta": "...",
  "riskFlags": []
}
```

Restrições:

- não inventar fatos;
- não alterar preço;
- não criar desconto inexistente;
- não afirmar frete grátis sem dado;
- não afirmar menor preço sem evidência;
- não afirmar estoque;
- não inventar cupom.

## 8. Telegram

Bot administrativo:

- /start
- /help
- /status
- /ofertas
- /publicar
- /pausar
- /retomar
- /monitorar
- /categorias

Publisher:

- texto;
- foto;
- botão de compra;
- identificação de oferta;
- aviso de preço sujeito a alteração quando necessário.

O canal deve ser público para os casos em que a política do programa exigir canal público.

## 9. Filas

BullMQ:

```text
product-ingestion
offer-normalization
price-snapshot
offer-scoring
affiliate-link
ai-generation
telegram-publish
price-alert
analytics
```

Cada job deve ser idempotente.

## 10. Banco

Entidades principais:

- User
- Marketplace
- AffiliateAccount
- Product
- ProductPrice
- Offer
- AffiliateLink
- Category
- TelegramChannel
- TelegramPost
- Click
- PriceAlert
- ScheduledPost
- AiGeneration
- SystemLog

## 11. Segurança

- JWT para painel, se autenticação própria for usada.
- RBAC para administração.
- secrets em env/secret manager.
- criptografar credenciais sensíveis quando persistidas.
- rate limiting na API.
- auditoria de ações administrativas.
- logs sem tokens/secrets.
- validação de payloads.
- proteção contra SSRF ao aceitar URLs externas.
- sanitização de conteúdo antes de renderização.

## 12. Observabilidade

Métricas:

- produtos coletados;
- ofertas qualificadas;
- ofertas publicadas;
- taxa de erro por connector;
- latência;
- jobs pendentes;
- falhas de publicação;
- cliques;
- CTR;
- vendas/comissões quando disponibilizadas.

## 13. Deploy

Docker Compose inicialmente:

- web
- api
- worker
- telegram-bot
- postgres
- redis
- nginx

Opcional:

- n8n para automações auxiliares;
- Prometheus/Grafana em fase posterior.

## 14. Desenvolvimento

Cada connector deve ser desenvolvido atrás de uma feature flag:

```env
SHOPEE_ENABLED=false
ALIEXPRESS_ENABLED=false
AMAZON_ENABLED=false
MERCADOLIVRE_ENABLED=false
MAGALU_ENABLED=false
```

Nunca colocar credenciais reais no repositório.

## 15. Testes

Obrigatórios:

- unit tests do Offer Engine;
- testes de normalização;
- testes de deduplicação;
- testes de cálculo de preço histórico;
- testes de score;
- testes de publicação;
- testes de retry de jobs;
- testes de segurança de URLs;
- integração mockada para cada connector.

Nenhum teste deve depender de API real em CI.

## 16. Critério de aceite do MVP

1. Produto mock entra pelo connector.
2. Produto é normalizado.
3. Snapshot de preço é salvo.
4. Oferta é pontuada.
5. Copy é gerada.
6. Link afiliado é anexado quando disponível.
7. Oferta aparece na fila.
8. Telegram publica.
9. Post é registrado.
10. Falha é recuperável por retry.
11. Dashboard mostra estado.

## 17. Roadmap de produto

V1:
Telegram + Shopee + AliExpress.

V2:
Amazon + ML + Magalu.

V3:
price alerts + analytics.

V4:
site público + SEO.

V5:
Instagram/TikTok/WhatsApp, apenas com integrações permitidas.

V6:
SaaS multi-tenant.
