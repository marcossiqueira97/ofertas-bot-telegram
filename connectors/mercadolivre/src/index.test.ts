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

  it('should evaluate affiliateLink capability to false when MERCADOLIVRE_MATT_WORD is absent/empty', () => {
    const connector = new MercadoLivreConnector();
    expect(connector.capabilities.affiliateLink).toBe(false);
  });

  it('should return NOT_AVAILABLE when creating affiliate link without matt_word', async () => {
    const connector = new MercadoLivreConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://produto.mercadolivre.com.br/MLB3456789'
    });
    expect(result.marketplace).toBe('mercadolivre');
    expect(result.affiliateUrl).toBe('NOT_AVAILABLE');
  });

  it('should generate affiliate URL with only matt_word when subId is provided', async () => {
    const connector = new MercadoLivreConnector();
    const result = await connector.createAffiliateLink({
      originalUrl: 'https://produto.mercadolivre.com.br/MLB3456789',
      subId: 'affiliate_user_123'
    });
    expect(result.marketplace).toBe('mercadolivre');
    expect(result.affiliateUrl).toBe('https://produto.mercadolivre.com.br/MLB3456789?matt_word=affiliate_user_123');
  });

  it('should preserve existing query parameters when appending matt_word', async () => {
    const connector = new MercadoLivreConnector();
    const originalUrl = 'https://produto.mercadolivre.com.br/MLB3456789?utm_source=google&pdp_filters=category:123';
    const result = await connector.createAffiliateLink({
      originalUrl,
      subId: 'affiliate_user_123'
    });
    expect(result.affiliateUrl).toContain('utm_source=google');
    expect(result.affiliateUrl).toContain('pdp_filters=category%3A123');
    expect(result.affiliateUrl).toContain('matt_word=affiliate_user_123');
  });

  it('should update existing matt_word parameter without duplication', async () => {
    const connector = new MercadoLivreConnector();
    const originalUrl = 'https://produto.mercadolivre.com.br/MLB3456789?matt_word=old_id&utm_source=google';
    const result = await connector.createAffiliateLink({
      originalUrl,
      subId: 'new_affiliate_id'
    });

    const parsed = new URL(result.affiliateUrl);
    expect(parsed.searchParams.getAll('matt_word')).toHaveLength(1);
    expect(parsed.searchParams.get('matt_word')).toBe('new_affiliate_id');
    expect(parsed.searchParams.get('utm_source')).toBe('google');
  });

  it('should throw clean controlled error on 403 Forbidden without returning fake products', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })
    );

    const connector = new MercadoLivreConnector();
    await expect(connector.searchProducts({ query: 'iphone' })).rejects.toThrow(
      'Mercado Livre API error 403: Authentication required. Please check MERCADOLIVRE_ACCESS_TOKEN.'
    );
  });

  it('should throw clean controlled error on 500 Server Error', async () => {
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

  it('should return real products when API succeeds with 200 OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
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

  it('should throw controlled error in getProduct() on HTTP error without fallback search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })
    );

    const connector = new MercadoLivreConnector();
    await expect(connector.getProduct('MLB999')).rejects.toThrow(
      'Mercado Livre API error fetching product MLB999: 404 Not Found'
    );
  });

  it('should throw controlled error in getOffers() on HTTP error without fake prices', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })
    );

    const connector = new MercadoLivreConnector();
    await expect(connector.getOffers({ productId: 'MLB999' })).rejects.toThrow(
      'Mercado Livre API error 403 fetching offers for product MLB999: Authentication required. Please check MERCADOLIVRE_ACCESS_TOKEN.'
    );
  });
});
