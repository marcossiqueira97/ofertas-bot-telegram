import { describe, it, expect } from 'vitest';
import { AliexpressConnector } from './index';

describe('AliexpressConnector', () => {
  it('should return correct health check status', async () => {
    const connectorDisabled = new AliexpressConnector(false);
    const healthDisabled = await connectorDisabled.healthCheck();
    expect(healthDisabled.status).toBe('ok');
    expect(healthDisabled.enabled).toBe(false);
    expect(healthDisabled.marketplace).toBe('aliexpress');

    const connectorEnabled = new AliexpressConnector(true);
    const healthEnabled = await connectorEnabled.healthCheck();
    expect(healthEnabled.enabled).toBe(true);
  });

  it('should search products', async () => {
    const connector = new AliexpressConnector();
    const products = await connector.searchProducts({ limit: 1 });
    expect(products).toHaveLength(1);
    expect(products[0].marketplace).toBe('aliexpress');
    expect(products[0].externalId).toBe('ali-2001');
  });

  it('should fetch product by id', async () => {
    const connector = new AliexpressConnector();
    const product = await connector.getProduct('ali-2001');
    expect(product).not.toBeNull();
    expect(product?.externalId).toBe('ali-2001');
  });

  it('should return null for non-existent product', async () => {
    const connector = new AliexpressConnector();
    const product = await connector.getProduct('unknown');
    expect(product).toBeNull();
  });

  it('should get normalized offers', async () => {
    const connector = new AliexpressConnector();
    const offers = await connector.getOffers({ productId: 'ali-2001' });
    expect(offers).toHaveLength(1);
    expect(offers[0].marketplace).toBe('aliexpress');
  });

  it('should generate affiliate link', async () => {
    const connector = new AliexpressConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://aliexpress.com/item/10050012345.html',
      subId: 'test_ali'
    });
    expect(result.marketplace).toBe('aliexpress');
    expect(result.affiliateUrl).toContain('_test_ali');
  });
});
