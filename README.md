# Vancod Ofertas — Automação & Afiliados AI Telegram

Plataforma completa e modular para automação, qualificação por IA e publicação de ofertas de afiliados no Telegram para **Shopee**, **AliExpress**, **Amazon**, **Mercado Livre** e **Magalu**.

---

## 🎯 Visão Geral

- **Coleta & Normalização**: Conectores isolados para cada marketplace com fallback em modo Mock e interfaces tipadas para produção.
- **Offer Engine & Historico**: Snapshot de preços, cálculo de métricas de 90 dias (menor preço em 7d, 30d, 90d, média de 30d, menor histórico) e cálculo de score ponderado (0 a 100).
- **Proteção SSRF**: Validador de domínio e URLs permitidas (`validateProductUrl`).
- **Resiliência Externa**: Wrapper `withResilience` com timeout configurável, retries com backoff exponencial, jitter e tratamento de Rate Limit.
- **Geração de Copy por IA**: IA factual que utiliza exclusivamente dados verificados da oferta (sem alucinação).
- **Links de Afiliados**: Parametrizados por variáveis de ambiente (`SHOPEE_AFFILIATE_ID`, `ALIEXPRESS_TRACKING_ID`, `AMAZON_ASSOCIATE_TAG`, `MERCADOLIVRE_AFFILIATE_TAG`, `MAGALU_STORE_NAME`).
- **Telegram Bot & Publisher**: Postagem formatada em Markdown com foto, preço com desconto e botão CTA direto para a oferta de afiliado.
- **Painel Dashboard Next.js**: 4 abas interativas (*Visão Geral*, *Aprovação Manual*, *Alertas de Preço*, *Agendamento de Posts*).

---

## 🚀 Como Executar

### 1. Requisitos
- Node.js (v20+)
- pnpm (v9+)
- Docker & Docker Compose (Opcional para ambiente local)

### 2. Configuração de Variáveis de Ambiente (`.env`)
Copie e ajuste as variáveis no arquivo `.env` na raiz do projeto:

```env
# Database & Cache
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vancod_ofertas?schema=public"
REDIS_URL="redis://localhost:6379"

# Telegram Bot & Channel
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyZ"
TELEGRAM_CHANNEL_ID="@vancod_ofertas_channel"

# Affiliate Tags & Store Names
SHOPEE_AFFILIATE_ID="seu_id_shopee"
ALIEXPRESS_TRACKING_ID="seu_tracking_id_ali"
AMAZON_ASSOCIATE_TAG="sua_tag_amazon-20"
MERCADOLIVRE_AFFILIATE_TAG="sua_tag_ml"
MAGALU_STORE_NAME="sua_loja_magazinevoce"
```

### 3. Desenvolvimento Local (Monorepo)

```bash
# Instalar dependências
pnpm install

# Gerar Prisma Client e popular banco
pnpm --filter @vancod/database prisma generate

# Executar suíte de testes unitários (20 tarefas passing)
pnpm test

# Executar compilação completa do projeto
pnpm build

# Executar todas as aplicações simultaneamente
pnpm dev
```

---

## 🐳 Execução via Docker Compose (Produção / VPS)

Para subir todos os microsserviços em contêineres:

```bash
# Subir PostgreSQL, Redis, API, Web, Worker e Telegram Bot
docker-compose up -d --build

# Verificar logs dos serviços
docker-compose logs -f
```

---

## 🧪 Testes Automatizados

O projeto conta com testes unitários em todos os conectores, no motor de score, na resiliência e no repositório de banco:

```bash
pnpm test
```

---

## 🏛️ Estrutura do Monorepo

```
vancod-ofertas-ai/
├── apps/
│   ├── api/            # API REST em NestJS (/offers, /connectors, /alerts, /schedule)
│   ├── web/            # Painel Dashboard em Next.js 15
│   ├── worker/         # Processador de filas de segundo plano BullMQ
│   └── telegram-bot/   # Bot de publicação e administração do Telegram
├── connectors/         # Módulos isolados por marketplace (shopee, aliexpress, amazon, mercadolivre, magalu)
├── packages/
│   ├── affiliate-core/ # Offer Engine, Resiliência, Validator SSRF, ConnectorRegistry
│   ├── ai/             # Provedor de geração de copy factual
│   ├── config/         # Validação de variáveis de ambiente com Zod
│   ├── database/       # Schema Prisma, migrations e OfferRepository
│   ├── logger/         # Logger unificado com Pino
│   └── types/          # Interfaces TypeScript compartilhadas
└── docker-compose.yml  # Orquestrador de contêineres de produção
```
