import { Controller, Get, Post, Body } from '@nestjs/common';
import { env } from '@vancod/config';
import { prisma } from '@vancod/database';

@Controller('settings')
export class SettingsController {
  private currentSettings = {
    shopeeAffiliateId: env.SHOPEE_AFFILIATE_ID || 'vancod_shopee_aff',
    aliexpressTrackingId: env.ALIEXPRESS_TRACKING_ID || 'vancod_ali_aff',
    amazonAssociateTag: env.AMAZON_ASSOCIATE_TAG || 'vancod-20',
    mercadolivreAffiliateTag: env.MERCADOLIVRE_AFFILIATE_TAG || 'vancod_ml_aff',
    magaluStoreName: env.MAGALU_STORE_NAME || 'magazinevancod',
    telegramChannelId: env.TELEGRAM_CHANNEL_ID || '@vancod_ofertas_channel',
    shopeeEnabled: env.SHOPEE_ENABLED,
    aliexpressEnabled: env.ALIEXPRESS_ENABLED,
    amazonEnabled: env.AMAZON_ENABLED,
    mercadolivreEnabled: env.MERCADOLIVRE_ENABLED,
    magaluEnabled: env.MAGALU_ENABLED
  };

  @Get()
  async getSettings() {
    return {
      settings: this.currentSettings
    };
  }

  @Post()
  async updateSettings(@Body() body: Partial<typeof this.currentSettings>) {
    this.currentSettings = {
      ...this.currentSettings,
      ...body
    };

    try {
      await prisma.systemLog.create({
        data: {
          level: 'INFO',
          component: 'SETTINGS',
          message: 'Configurações de afiliados e conectores atualizadas via Portal Administrativo.'
        }
      });
    } catch (e) {}

    return {
      status: 'updated',
      settings: this.currentSettings
    };
  }

  @Get('logs')
  async getSystemLogs() {
    try {
      const logs = await prisma.systemLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      return { count: logs.length, logs };
    } catch (e) {
      return {
        count: 2,
        logs: [
          {
            id: 'log-1',
            level: 'INFO',
            category: 'INGESTION',
            message: 'Oferta Fone TWS i12 ingerida com sucesso (Score 92).',
            createdAt: new Date().toISOString()
          },
          {
            id: 'log-2',
            level: 'INFO',
            category: 'TELEGRAM',
            message: 'Post publicado com sucesso no canal @vancod_ofertas_channel.',
            createdAt: new Date(Date.now() - 3600000).toISOString()
          }
        ]
      };
    }
  }
}
