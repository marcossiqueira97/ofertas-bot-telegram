# Integrações de Afiliados

Este documento separa o que é infraestrutura própria do que depende de aprovação/credenciais externas.

## Telegram

Não é programa de afiliados. Criar bot via BotFather e obter token. Adicionar o bot como administrador do canal.

## Shopee

Objetivo: utilizar API/feed oficial disponibilizado ao afiliado, conforme elegibilidade e documentação vigente.

Necessário:
- conta de afiliado;
- acesso/credenciais da integração (`SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`);
- respeitar limites e regras de uso do programa.

Modo Mock / Simulação ativo para desenvolvimento local.

## AliExpress

Objetivo: utilizar a infraestrutura oficial de afiliados/marketing e seus recursos de API/deep link quando disponíveis para a conta.

Necessário:
- conta no programa;
- aplicação/credenciais (`ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`);
- tracking ID (`ALIEXPRESS_TRACKING_ID`).

Modo Mock / Simulação ativo para desenvolvimento local.

## Amazon

Usar a Creators API, não construir sobre a antiga PA-API.

A disponibilidade depende dos requisitos e elegibilidade atuais da conta (`AMAZON_ASSOCIATE_TAG`).

Connector desacoplado e funcional em modo resiliência.

## Mercado Livre

Busca em tempo real de produtos da plataforma Mercado Livre Brasil via API oficial pública (`https://api.mercadolibre.com/sites/MLB/search`).

Links de afiliado parametrizados por `matt_word` (`MERCADOLIVRE_MATT_WORD`) e opcionalmente `matt_tool` (`MERCADOLIVRE_MATT_TOOL`).

## Magalu

Usar o método oficialmente disponibilizado pelo programa de afiliados/influenciador (`MAGALU_STORE_NAME`).

## Matriz de Integração Atualizada

| Marketplace | Fonte | Link Afiliado | Status |
|---|---|---|---|
| Shopee | API/feed oficial | recurso oficial | Ativo (Mock / Prod Ready) |
| AliExpress | API/portal oficial | deep link oficial | Ativo (Mock / Prod Ready) |
| Amazon | Creators API | recurso oficial | Ativo (Mock / Prod Ready) |
| Mercado Livre | API pública oficial (MLB) | recurso oficial (matt_tool) | Ativo em Tempo Real |
| Magalu | programa oficial | recurso oficial | Ativo (Mock / Prod Ready) |

Atualizar esta tabela conforme credenciais de produção forem inseridas no `.env`.
