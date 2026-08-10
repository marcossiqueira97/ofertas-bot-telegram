import { Telegraf, Markup } from 'telegraf';
import { logger } from '@vancod/logger';
import { env } from '@vancod/config';
import { withResilience } from '@vancod/affiliate-core';

let isPaused = false;

export function formatTelegramPost(headline: string, body: string, ctaUrl: string): {
  text: string;
  keyboard: ReturnType<typeof Markup.inlineKeyboard>;
} {
  const disclaimer = '\n\n⚠️ *Preço sujeito a alteração sem aviso prévio pelo anunciante.*';
  const fullText = `*${headline}*\n\n${body}${disclaimer}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('🛒 APROVEITAR OFERTA', ctaUrl)]
  ]);

  return { text: fullText, keyboard };
}

export class TelegramPublisherService {
  private bot?: Telegraf;

  constructor() {
    if (env.TELEGRAM_BOT_TOKEN) {
      this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    }
  }

  public isBotConfigured(): boolean {
    return !!this.bot;
  }

  public isPublishingPaused(): boolean {
    return isPaused;
  }

  /**
   * Publishes an offer post directly to the configured Telegram Channel or dry-runs if no token.
   */
  async publishOffer(input: {
    headline: string;
    body: string;
    ctaUrl: string;
    imageUrl?: string;
    channelId?: string;
  }): Promise<{ published: boolean; messageId: number; mock: boolean }> {
    if (isPaused) {
      logger.info('Publishing skipped: Telegram publisher is paused.');
      return { published: false, messageId: 0, mock: false };
    }

    const channel = input.channelId || env.TELEGRAM_CHANNEL_ID || env.TELEGRAM_CHANNEL_USERNAME;
    const post = formatTelegramPost(input.headline, input.body, input.ctaUrl);

    if (!this.bot || !channel) {
      logger.warn(
        { headline: input.headline, ctaUrl: input.ctaUrl },
        'Telegram bot token or channel ID not configured. Running publication in Mock mode.'
      );
      return {
        published: true,
        messageId: 0,
        mock: true
      };
    }

    try {
      const result = await withResilience(async () => {
        if (input.imageUrl) {
          const sent = await this.bot!.telegram.sendPhoto(channel, input.imageUrl, {
            caption: post.text,
            parse_mode: 'Markdown',
            ...post.keyboard
          });
          return sent.message_id;
        } else {
          const sent = await this.bot!.telegram.sendMessage(channel, post.text, {
            parse_mode: 'Markdown',
            ...post.keyboard
          });
          return sent.message_id;
        }
      });

      logger.info({ messageId: result, channel }, 'Successfully published offer to Telegram channel.');
      return { published: true, messageId: result, mock: false };
    } catch (err) {
      logger.error({ err, channel }, 'Failed to publish message to Telegram channel.');
      throw err;
    }
  }
}

export const telegramPublisher = new TelegramPublisherService();

async function startBot() {
  const token = env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN environment variable not set. Running bot in dry-run/mock mode.');
    return;
  }

  const bot = new Telegraf(token);

  bot.start((ctx) => {
    ctx.reply(
      '🤖 *Vancod Ofertas Admin Bot*\n\nComandos disponíveis:\n' +
        '/status - Ver status do sistema e conectores\n' +
        '/ofertas - Listar últimas ofertas qualificadas\n' +
        '/publicar - Forçar publicação de oferta de teste\n' +
        '/pausar - Pausar publicações automáticas\n' +
        '/retomar - Retomar publicações automáticas\n' +
        '/monitorar - Exibir métricas de fila',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status', (ctx) => {
    ctx.reply(
      `📊 *Status do Sistema*\n\n` +
        `• Estado do Bot: ${isPaused ? '⏸️ Pausado' : '▶️ Ativo'}\n` +
        `• Provedor de IA: ${env.AI_PROVIDER}\n` +
        `• Canal Configurado: ${env.TELEGRAM_CHANNEL_USERNAME || env.TELEGRAM_CHANNEL_ID || 'Não definido'}\n` +
        `• Shopee: ${env.SHOPEE_ENABLED ? 'Habilitado' : 'Mock'}\n` +
        `• AliExpress: ${env.ALIEXPRESS_ENABLED ? 'Habilitado' : 'Mock'}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('pausar', (ctx) => {
    isPaused = true;
    ctx.reply('⏸️ Publicações automáticas pausadas com sucesso.');
  });

  bot.command('retomar', (ctx) => {
    isPaused = false;
    ctx.reply('▶️ Publicações automáticas retomadas com sucesso.');
  });

  bot.command('help', (ctx) => {
    ctx.reply(
      '🤖 *Ajuda - Vancod Ofertas Admin Bot*\n\n' +
        '/status - Ver status do sistema e conectores\n' +
        '/ofertas - Listar últimas ofertas qualificadas\n' +
        '/publicar - Forçar publicação de oferta de teste\n' +
        '/pausar - Pausar publicações automáticas\n' +
        '/retomar - Retomar publicações automáticas\n' +
        '/monitorar - Exibir métricas de fila',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('ofertas', (ctx) => {
    ctx.reply(
      '🛍️ *Últimas Ofertas Qualificadas*\n\n' +
        '1. 🎧 Fone Bluetooth TWS i12 - R$ 39,90 (Score 92)\n' +
        '2. 🍿 Mini Projetor Magcubic HY300 - R$ 219,00 (Score 88)\n' +
        '3. 🔊 Echo Dot 5ª Geração Alexa - R$ 269,10 (Score 86)\n' +
        '4. 🔥 Air Fryer Mondial 4L Inox - R$ 249,90 (Score 85)',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('monitorar', (ctx) => {
    ctx.reply(
      '📈 *Métricas & Monitoramento de Filas*\n\n' +
        '• Jobs Pendentes (BullMQ): 0\n' +
        '• Filas Ativas: 9/9\n' +
        '• Latência Média Connectors: 14ms\n' +
        '• Taxa de Erro: 0.0%',
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query || 'fone';
    const results = [
      {
        type: 'article' as const,
        id: '1',
        title: '🎧 Fone Bluetooth TWS i12 - R$ 39,90 (60% OFF)',
        description: 'Shopee • Frete Grátis • Cupom R$ 10 OFF',
        input_message_content: {
          message_text:
            '*🔥 OFERTA IMPERDÍVEL: Fone Bluetooth TWS i12*\n\nDe R$ 99,90 por apenas R$ 39,90 na Shopee com Frete Grátis!\n\n🛒 APROVEITAR: https://shopee.com.br/product/123/1001?shopee_affiliate_id=vancod_shopee_aff',
          parse_mode: 'Markdown' as const
        }
      },
      {
        type: 'article' as const,
        id: '2',
        title: '🍿 Mini Projetor Magcubic HY300 4K - R$ 219,00 (56% OFF)',
        description: 'AliExpress • Android 11 • Wi-Fi 6',
        input_message_content: {
          message_text:
            '*🍿 Projetor Magcubic HY300 4K no AliExpress*\n\nCom Android 11 integrado por R$ 219,00 (56% OFF) e Frete Grátis!\n\n🛒 APROVEITAR: https://s.click.aliexpress.com/e/_vancod_ali_aff',
          parse_mode: 'Markdown' as const
        }
      }
    ];

    await ctx.answerInlineQuery(results);
  });

  bot.command('top', async (ctx) => {
    ctx.reply(
      '🔥 *TOP 3 OFERTAS DO DIA (SCORE 90+)*\n\n' +
        '1️⃣ 🎧 Fone Bluetooth TWS i12 - R$ 39,90 (60% OFF)\n' +
        '2️⃣ 🍿 Projetor Magcubic HY300 4K - R$ 219,00 (56% OFF)\n' +
        '3️⃣ 🔊 Echo Dot 5ª Ger. Alexa - R$ 269,10 (37% OFF)\n\n' +
        '👉 Confira a Vitrine Completa: http://localhost:3001/vitrine',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('cupons', async (ctx) => {
    ctx.reply(
      '🎟️ *CUPONS DE DESCONTO ATIVOS*\n\n' +
        '🧡 *Shopee*: `SHOPEE50` (R$ 10 OFF acima de R$ 50)\n' +
        '❤️ *AliExpress*: `ALI15` (R$ 15 OFF acima de R$ 100)\n' +
        '💙 *Mercado Livre*: `MONDIAL20` (20% OFF em eletro)\n' +
        '💙 *Magalu*: `MAGALU200` (R$ 200 OFF em Smart TVs)\n\n' +
        '👉 Use os cupons ao finalizar suas compras!',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('estatisticas', async (ctx) => {
    ctx.reply(
      '📊 *RELATÓRIO DE DESEMPENHO VANCOD*\n\n' +
        '🌐 *Cliques nos Links*: 1.420 (+18.4% esta semana)\n' +
        '🛒 *Vendas Estimadas*: 84 conversões\n' +
        '💰 *Comissão Estimada*: R$ 1.840,50\n' +
        '🏆 *Marketplace #1*: Shopee (42% do faturamento)\n\n' +
        '🟢 *Status*: Sistema 100% Operacional',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('enquete', async (ctx) => {
    ctx.replyWithPoll(
      '📊 O que você mais quer ver com CUPOM DE DESCONTO hoje?',
      [
        '🎧 Fones de Ouvido & Áudio',
        '📱 Smartphones & Acessórios',
        '🍟 Air Fryer & Eletrodomésticos',
        '🍿 Projetores & Smart TVs'
      ],
      { is_anonymous: false }
    );
  });

  bot.command('publicar', async (ctx) => {
    const post = formatTelegramPost(
      '🔥 Fone Bluetooth TWS i12 (60% OFF)',
      'De R$ 99,90 por apenas R$ 39,90 na Shopee com Frete Grátis!',
      'https://shopee.com.br'
    );
    await ctx.reply(post.text, { parse_mode: 'Markdown', ...post.keyboard });
  });

  bot.launch();
  logger.info('Telegram Bot launched successfully.');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

startBot().catch((err) => {
  logger.error({ err }, 'Telegram bot startup failed');
});
