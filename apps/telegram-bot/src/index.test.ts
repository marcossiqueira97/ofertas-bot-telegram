import { describe, it, expect } from 'vitest';
import { formatTelegramPost, TelegramPublisherService } from './index';

describe('Telegram Bot Utilities', () => {
  it('should format telegram post correctly with markdown and disclaimer', () => {
    const post = formatTelegramPost(
      'Fone Bluetooth TWS (50% OFF)',
      'Aproveite a promoção por apenas R$ 49,90!',
      'https://shopee.com.br'
    );

    expect(post.text).toContain('*Fone Bluetooth TWS (50% OFF)*');
    expect(post.text).toContain('Aproveite a promoção por apenas R$ 49,90!');
    expect(post.text).toContain('⚠️ *Preço sujeito a alteração sem aviso prévio pelo anunciante.*');
    expect(post.keyboard).toBeDefined();
  });

  it('should publish offer in mock mode when bot token is not configured', async () => {
    const service = new TelegramPublisherService();
    const result = await service.publishOffer({
      headline: 'Oferta de Teste',
      body: 'Corpo da oferta',
      ctaUrl: 'https://shopee.com.br'
    });

    expect(result.published).toBe(true);
    expect(result.mock).toBe(true);
    expect(result.messageId).toBeGreaterThan(0);
  });
});
