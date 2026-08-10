import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoLivreConnector } from './index';

describe('MercadoLivreConnector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return correct health check status', async () => {
    const connector = new MercadoLivreConnector(false);
    const health = await connector.healthCheck();
    expect(health.status).toBe('ok');
    expect(health.marketplace).toBe('mercadolivre');
    expect(health.enabled).toBe(false);
  });

  it('should have affiliateLink capability set to false', () => {
    const connector = new MercadoLivreConnector();
    expect(connector.capabilities.affiliateLink).toBe(false);
  });

  it('should return NOT_AVAILABLE for affiliate links without official API', async () => {
    const connector = new MercadoLivreConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://produto.mercadolivre.com.br/MLB3456789'
    });
    expect(result.marketplace).toBe('mercadolivre');
    expect(result.affiliateUrl).toBe('NOT_AVAILABLE');
  });

  it('should throw clean error when API fails without returning fake products', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
    );

    const connector = new MercadoLivreConnector();
    await expect(connector.searchProducts({ query: 'iphone' })).rejects.toThrow(
      'Mercado Livre Public API HTTP Error: 500 Internal Server Error'
    );
  });

  it('should return real products when API succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'MLB100',
              title: 'Smartphone Real ML',
              permalink: 'https://produto.mercadolivre.com.br/MLB100',
              thumbnail: 'http://img.ml/100-I.jpg'
            }
          ]
        })
      })
    );

    const connector = new MercadoLivreConnector();
    const products = await connector.searchProducts({ query: 'smartphone' });
    expect(products).toHaveLength(1);
    expect(products[0].externalId).toBe('MLB100');
    expect(products[0].title).toBe('Smartphone Real ML');
  });
});
