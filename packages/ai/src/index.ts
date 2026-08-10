import { AiCopyInput, AiCopyOutput } from '@vancod/types';

export interface AiProvider {
  name: string;
  generateCopy(input: AiCopyInput): Promise<AiCopyOutput>;
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async generateCopy(input: AiCopyInput): Promise<AiCopyOutput> {
    const discountText = input.discountPercent ? ` (${input.discountPercent}% OFF)` : '';
    const oldPriceText = input.oldPrice ? ` de R$ ${input.oldPrice.toFixed(2)} por` : '';
    const couponText = input.coupon ? `\n🎟️ Cupom: ${input.coupon}` : '';
    const shippingText = input.shipping ? `\n🚚 Frete: ${input.shipping}` : '';
    const ratingText = input.rating ? `\n⭐ Avaliação: ${input.rating}/5.0` : '';

    const headline = `🔥 OFERTA IMPERDÍVEL: ${input.title}${discountText}`;
    const body = `De R$ ${input.price.toFixed(2)}${oldPriceText} no ${input.marketplace.toUpperCase()}.${ratingText}${shippingText}${couponText}`;

    return {
      headline,
      body,
      cta: '🛒 Ver oferta no ' + input.marketplace,
      riskFlags: []
    };
  }
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateCopy(input: AiCopyInput): Promise<AiCopyOutput> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key missing. Falling back to MockAiProvider.');
    }
    // Stub implementation until live API key is set
    const mock = new MockAiProvider();
    return mock.generateCopy(input);
  }
}

export function createAiProvider(providerType = 'mock', apiKey = ''): AiProvider {
  if (providerType === 'openai' && apiKey) {
    return new OpenAiProvider(apiKey);
  }
  return new MockAiProvider();
}
