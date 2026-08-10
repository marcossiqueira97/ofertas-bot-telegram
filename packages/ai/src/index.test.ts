import { describe, it, expect } from 'vitest';
import { MockAiProvider, createAiProvider } from './index';

describe('AI Package Unit Tests', () => {
  it('should generate factual copy without inventing data in MockAiProvider', async () => {
    const provider = new MockAiProvider();
    const output = await provider.generateCopy({
      title: 'Fone Bluetooth TWS',
      price: 89.9,
      oldPrice: 150.0,
      discountPercent: 40,
      marketplace: 'Shopee',
      coupon: 'FRETEGRATIS'
    });

    expect(output.headline).toContain('Fone Bluetooth TWS');
    expect(output.headline).toContain('40% OFF');
    expect(output.body).toContain('R$ 89.90');
    expect(output.body).toContain('FRETEGRATIS');
    expect(output.cta).toContain('Shopee');
    expect(output.riskFlags).toHaveLength(0);
  });

  it('should return mock provider by default in createAiProvider', () => {
    const provider = createAiProvider();
    expect(provider.name).toBe('mock');
  });
});
