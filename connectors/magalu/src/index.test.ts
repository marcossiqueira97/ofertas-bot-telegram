import { describe, it, expect } from 'vitest';
import { MagaluConnector } from './index';

describe('MagaluConnector', () => {
  it('should return correct health check status', async () => {
    const connector = new MagaluConnector(true);
    const health = await connector.healthCheck();
    expect(health.status).toBe('ok');
    expect(health.marketplace).toBe('magalu');
    expect(health.enabled).toBe(true);
  });

  it('should search products', async () => {
    const connector = new MagaluConnector();
    const products = await connector.searchProducts({ limit: 1 });
    expect(products).toHaveLength(1);
    expect(products[0].marketplace).toBe('magalu');
    expect(products[0].externalId).toBe('mgl-5001');
  });

  it('should fetch product by id', async () => {
    const connector = new MagaluConnector();
    const product = await connector.getProduct('mgl-5001');
    expect(product).not.toBeNull();
    expect(product?.externalId).toBe('mgl-5001');
  });

  it('should get normalized offers', async () => {
    const connector = new MagaluConnector();
    const offers = await connector.getOffers({ productId: 'mgl-5001' });
    expect(offers).toHaveLength(1);
    expect(offers[0].marketplace).toBe('magalu');
  });

  it('should generate affiliate link', async () => {
    const connector = new MagaluConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://magazineluiza.com.br/p/mgl-5001',
      subId: 'custom_mgl'
    });
    expect(result.marketplace).toBe('magalu');
    expect(result.affiliateUrl).toContain('custom_mgl');
  });
});
