import { describe, it, expect } from 'vitest';
import { AmazonConnector } from './index';

describe('AmazonConnector', () => {
  it('should return correct health check status', async () => {
    const connector = new AmazonConnector(true);
    const health = await connector.healthCheck();
    expect(health.status).toBe('ok');
    expect(health.marketplace).toBe('amazon');
    expect(health.enabled).toBe(true);
  });

  it('should search products', async () => {
    const connector = new AmazonConnector();
    const products = await connector.searchProducts({ limit: 1 });
    expect(products).toHaveLength(1);
    expect(products[0].marketplace).toBe('amazon');
    expect(products[0].externalId).toBe('B09B2W722X');
  });

  it('should fetch product by id', async () => {
    const connector = new AmazonConnector();
    const product = await connector.getProduct('B09B2W722X');
    expect(product).not.toBeNull();
    expect(product?.externalId).toBe('B09B2W722X');
  });

  it('should get normalized offers', async () => {
    const connector = new AmazonConnector();
    const offers = await connector.getOffers({ productId: 'B09B2W722X' });
    expect(offers).toHaveLength(1);
    expect(offers[0].marketplace).toBe('amazon');
  });

  it('should generate affiliate link', async () => {
    const connector = new AmazonConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://amazon.com.br/dp/B09B2W722X'
    });
    expect(result.marketplace).toBe('amazon');
    expect(result.affiliateUrl).toContain('tag=vancod-20');

    const subResult = await connector.createAffiliateLink({
      originalUrl: 'https://amazon.com.br/dp/B09B2W722X',
      subId: 'custom-tag-20'
    });
    expect(subResult.affiliateUrl).toContain('tag=custom-tag-20');
  });
});
