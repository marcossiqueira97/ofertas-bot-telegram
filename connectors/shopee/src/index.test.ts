import { describe, it, expect } from 'vitest';
import { ShopeeConnector } from './index';

describe('ShopeeConnector', () => {
  it('should return correct health check status', async () => {
    const connectorDisabled = new ShopeeConnector(false);
    const healthDisabled = await connectorDisabled.healthCheck();
    expect(healthDisabled.status).toBe('ok');
    expect(healthDisabled.enabled).toBe(false);
    expect(healthDisabled.marketplace).toBe('shopee');

    const connectorEnabled = new ShopeeConnector(true);
    const healthEnabled = await connectorEnabled.healthCheck();
    expect(healthEnabled.enabled).toBe(true);
  });

  it('should search products and apply limit', async () => {
    const connector = new ShopeeConnector();
    const products = await connector.searchProducts({ limit: 1 });
    expect(products).toHaveLength(1);
    expect(products[0].marketplace).toBe('shopee');
    expect(products[0].externalId).toBeDefined();
  });

  it('should fetch product by id', async () => {
    const connector = new ShopeeConnector();
    const product = await connector.getProduct('shp-1001');
    expect(product).not.toBeNull();
    expect(product?.externalId).toBe('shp-1001');
  });

  it('should return null for non-existent product', async () => {
    const connector = new ShopeeConnector();
    const product = await connector.getProduct('non-existent');
    expect(product).toBeNull();
  });

  it('should get normalized offers', async () => {
    const connector = new ShopeeConnector();
    const offers = await connector.getOffers({ productId: 'shp-1001' });
    expect(offers).toHaveLength(1);
    expect(offers[0].marketplace).toBe('shopee');
    expect(offers[0].price).toBeGreaterThan(0);
  });

  it('should generate affiliate link', async () => {
    const connector = new ShopeeConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://shopee.com.br/product/123/1001',
      subId: 'test_sub'
    });
    expect(result.marketplace).toBe('shopee');
    expect(result.affiliateUrl).toContain('shopee_affiliate_id=test_sub');

    const defaultResult = await connector.createAffiliateLink({
      originalUrl: 'https://shopee.com.br/product/123/1001'
    });
    expect(defaultResult.affiliateUrl).toContain('shopee_affiliate_id=vancod_shopee_aff');
  });
});
