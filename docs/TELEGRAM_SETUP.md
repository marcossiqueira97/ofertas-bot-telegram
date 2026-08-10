# Configuração do Telegram

## 1. Criar canal

Criar um canal público, por exemplo:

`Vancod Ofertas`

Definir username público quando disponível.

## 2. Criar bot

Usar o BotFather.

Guardar o token somente no `.env`.

## 3. Permissões

Adicionar o bot como administrador do canal com permissão para publicar mensagens e mídia conforme necessário.

## 4. Variáveis

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
TELEGRAM_CHANNEL_USERNAME=
```

## 5. Publicação

A publicação deve passar por:

```text
Offer
 -> Policy Check
 -> Content Validation
 -> Publisher
 -> Telegram
 -> TelegramPost
```

## 6. Segurança

Nunca registrar o token nos logs.
Nunca colocar token em frontend.
Rotacionar token se houver vazamento.
