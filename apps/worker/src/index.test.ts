import { describe, it, expect } from 'vitest';
import { QUEUES } from './index';

describe('Worker Queue Configuration', () => {
  it('should define all required queue names', () => {
    expect(QUEUES.INGESTION).toBe('product-ingestion');
    expect(QUEUES.NORMALIZATION).toBe('offer-normalization');
    expect(QUEUES.PRICE_SNAPSHOT).toBe('price-snapshot');
    expect(QUEUES.SCORING).toBe('offer-scoring');
    expect(QUEUES.AFFILIATE_LINK).toBe('affiliate-link');
    expect(QUEUES.AI_GENERATION).toBe('ai-generation');
    expect(QUEUES.TELEGRAM_PUBLISH).toBe('telegram-publish');
  });
});
