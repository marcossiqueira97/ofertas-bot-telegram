# Prompt mestre para a IA construir o projeto

Você é o engenheiro principal do projeto Vancod Ofertas.

Construa o projeto descrito neste repositório seguindo `README.md`, `IMPLEMENTATION_PLAN.md`, `AGENTS.md` e os demais documentos.

## Ordem obrigatória

### Etapa 1
Criar monorepo com pnpm + Turborepo.

### Etapa 2
Criar apps:
- web
- api
- worker
- telegram-bot

### Etapa 3
Criar packages:
- database
- types
- config
- logger
- affiliate-core
- ai

### Etapa 4
Criar infraestrutura:
- PostgreSQL
- Redis
- Docker Compose

### Etapa 5
Criar Prisma schema para:
- Product
- ProductPrice
- Offer
- AffiliateLink
- Marketplace
- Category
- TelegramChannel
- TelegramPost
- Click
- PriceAlert
- ScheduledPost
- AiGeneration
- SystemLog

### Etapa 6
Criar Offer Engine:
- normalização
- deduplicação
- histórico
- score
- policy check

### Etapa 7
Criar Telegram:
- bot
- publisher
- comandos
- botões
- fila de publicação

### Etapa 8
Criar IA com adapter/provider abstrato e mock.

### Etapa 9
Criar connectors em modo mock:
- Shopee
- AliExpress
- Amazon
- Mercado Livre
- Magalu

### Etapa 10
Criar testes unitários e de integração usando mocks.

### Etapa 11
Somente depois implementar integrações reais. Para cada marketplace:
- consultar documentação oficial atual;
- confirmar autenticação;
- confirmar permissões;
- confirmar endpoints;
- confirmar limites;
- confirmar regras de afiliados;
- implementar sem bypass.

### Etapa 12
Criar dashboard mínimo:
- status dos connectors;
- ofertas;
- fila;
- publicadas;
- rejeitadas;
- erros.

## Importante

Não invente credenciais, endpoints ou URLs de API.

Se alguma integração não puder ser implementada sem acesso aprovado, deixe o adapter pronto, documente os requisitos e mantenha um mock funcional.

## Resultado esperado

O comando de desenvolvimento deve subir:

- PostgreSQL
- Redis
- API
- Worker
- Bot
- Web

e permitir testar o fluxo completo com ofertas mock:

```text
Mock Marketplace
 -> Product
 -> Price History
 -> Offer Score
 -> AI Copy
 -> Affiliate URL Mock
 -> Telegram Mock/Real
```

O sistema deve estar preparado para produção, mas não deve fingir que uma integração externa está configurada quando não está.
