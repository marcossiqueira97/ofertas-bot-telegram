import { Telegraf, Markup } from 'telegraf';
import { logger } from '@vancod/logger';
import { env } from '@vancod/config';
import { withResilience } from '@vancod/affiliate-core';
import { prisma } from '@vancod/database';

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
  }): Promise<{ published: boolean; messageId: number; mock: boolean; status: string }> {
    if (isPaused) {
      logger.info('Publishing skipped: Telegram publisher is paused.');
      return { published: false, messageId: 0, mock: false, status: 'PAUSED' };
    }

    const channel = input.channelId || env.TELEGRAM_CHANNEL_ID || env.TELEGRAM_CHANNEL_USERNAME;
    const post = formatTelegramPost(input.headline, input.body, input.ctaUrl);

    if (!this.bot || !channel) {
      logger.warn(
        { headline: input.headline, ctaUrl: input.ctaUrl },
        'Telegram bot token or channel ID not configured. Running publication in NOT_CONFIGURED mode.'
      );
      return {
        published: false,
        messageId: 0,
        mock: true,
        status: 'NOT_CONFIGURED'
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
      return { published: true, messageId: result, mock: false, status: 'PUBLISHED' };
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

  bot.command('ofertas', async (ctx) => {
    try {
      const offers = await prisma.offer.findMany({
        take: 5,
        orderBy: { capturedAt: 'desc' },
        include: { product: true }
      });

      if (!offers || offers.length === 0) {
        ctx.reply('Nenhum dado disponível.');
        return;
      }

      let text = '🛍️ *Últimas Ofertas Qualificadas*\n\n';
      offers.forEach((o: any, i: number) => {
        text += `${i + 1}. ${o.product.title} - R$ ${Number(o.price).toFixed(2)} (Score ${Number(o.score)})\n`;
      });

      ctx.reply(text, { parse_mode: 'Markdown' });
    } catch {
      ctx.reply('Nenhum dado disponível.');
    }
  });

  bot.command('monitorar', async (ctx) => {
    try {
      const totalProducts = await prisma.product.count();
      const totalOffers = await prisma.offer.count();

      if (totalProducts === 0 && totalOffers === 0) {
        ctx.reply('Nenhum dado disponível.');
        return;
      }

      ctx.reply(
        '📈 *Métricas do Sistema*\n\n' +
          `• Produtos Cadastrados: ${totalProducts}\n` +
          `• Ofertas Gravadas: ${totalOffers}`,
        { parse_mode: 'Markdown' }
      );
    } catch {
      ctx.reply('Nenhum dado disponível.');
    }
  });

  bot.command('top', async (ctx) => {
    try {
      const topOffers = await prisma.offer.findMany({
        take: 3,
        orderBy: { score: 'desc' },
        include: { product: true }
      });

      if (!topOffers || topOffers.length === 0) {
        ctx.reply('Nenhum dado disponível.');
        return;
      }

      let text = '🔥 *TOP OFERTAS DO DIA*\n\n';
      topOffers.forEach((o: any, i: number) => {
        text += `${i + 1}️⃣ ${o.product.title} - R$ ${Number(o.price).toFixed(2)} (Score ${Number(o.score)})\n`;
      });

      ctx.reply(text, { parse_mode: 'Markdown' });
    } catch {
      ctx.reply('Nenhum dado disponível.');
    }
  });

  bot.command('cupons', async (ctx) => {
    try {
      const couponOffers = await prisma.offer.findMany({
        where: { couponCode: { not: null } },
        take: 5,
        include: { product: true }
      });

      if (!couponOffers || couponOffers.length === 0) {
        ctx.reply('Nenhum dado disponível.');
        return;
      }

      let text = '🎟️ *CUPONS DE DESCONTO ATIVOS*\n\n';
      couponOffers.forEach((o: any) => {
        text += `• *${o.product.title}*: \`${o.couponCode}\`\n`;
      });

      ctx.reply(text, { parse_mode: 'Markdown' });
    } catch {
      ctx.reply('Nenhum dado disponível.');
    }
  });

  bot.command('estatisticas', async (ctx) => {
    try {
      const totalPosts = await prisma.telegramPost.count({ where: { status: 'PUBLISHED' } });
      const totalOffers = await prisma.offer.count();

      if (totalPosts === 0 && totalOffers === 0) {
        ctx.reply('Nenhum dado disponível.');
        return;
      }

      ctx.reply(
        '📊 *RELATÓRIO DE DESEMPENHO*\n\n' +
          `🛒 *Total Ofertas*: ${totalOffers}\n` +
          `📢 *Publicações Realizadas*: ${totalPosts}`,
        { parse_mode: 'Markdown' }
      );
    } catch {
      ctx.reply('Nenhum dado disponível.');
    }
  });

  bot.command('publicar', async (ctx) => {
    try {
      const lastApproved = await prisma.offer.findFirst({
        where: { status: 'AUTO_APPROVED' },
        include: { product: true, aiGenerations: true, affiliateLinks: true },
        orderBy: { capturedAt: 'desc' }
      });

      if (!lastApproved || !lastApproved.aiGenerations[0]) {
        ctx.reply('Nenhum dado disponível.');
        return;
      }

      const copy = lastApproved.aiGenerations[0];
      const ctaUrl = lastApproved.affiliateLinks[0]?.affiliateUrl || lastApproved.product.productUrl;

      const post = formatTelegramPost(copy.headline, copy.body, ctaUrl);
      await ctx.reply(post.text, { parse_mode: 'Markdown', ...post.keyboard });
    } catch {
      ctx.reply('Nenhum dado disponível.');
    }
  });

  bot.launch();
  logger.info('Telegram Bot launched successfully.');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

startBot().catch((err) => {
  logger.error({ err }, 'Telegram bot startup failed');
});
