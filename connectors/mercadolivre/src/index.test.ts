import { describe, it, expect } from 'vitest';
import { MercadoLivreConnector } from './index';

describe('MercadoLivreConnector', () => {
  it('should return correct health check status', async () => {
    const connector = new MercadoLivreConnector(false);
    const health = await connector.healthCheck();
    expect(health.status).toBe('ok');
    expect(health.marketplace).toBe('mercadolivre');
    expect(health.enabled).toBe(false);
  });

  it('should search products', async () => {
    const connector = new MercadoLivreConnector();
    const products = await connector.searchProducts({ limit: 1 });
    expect(products).toHaveLength(1);
    expect(products[0].marketplace).toBe('mercadolivre');
    expect(products[0].externalId).toBe('MLB3456789');
  });

  it('should fetch product by id', async () => {
    const connector = new MercadoLivreConnector();
    const product = await connector.getProduct('MLB3456789');
    expect(product).not.toBeNull();
    expect(product?.externalId).toBe('MLB3456789');
  });

  it('should get normalized offers', async () => {
    const connector = new MercadoLivreConnector();
    const offers = await connector.getOffers({ productId: 'MLB3456789' });
    expect(offers).toHaveLength(1);
    expect(offers[0].marketplace).toBe('mercadolivre');
  });

  it('should generate affiliate link', async () => {
    const connector = new MercadoLivreConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://produto.mercadolivre.com.br/MLB3456789'
    });
    expect(result.marketplace).toBe('mercadolivre');
    expect(result.affiliateUrl).toContain('matt_tool=vancod_ml_aff');

    const subIdResult = await connector.createAffiliateLink({
      originalUrl: 'https://produto.mercadolivre.com.br/MLB3456789',
      subId: 'custom_tag'
    });
    expect(subIdResult.affiliateUrl).toContain('matt_tool=custom_tag');
  });
});
