import {
  MarketplaceConnector,
  MarketplaceName,
  ConnectorHealth,
  SearchInput,
  NormalizedProduct,
  OfferQuery,
  NormalizedOffer,
  AffiliateLinkInput,
  AffiliateLinkResult,
  ConnectorCapabilities
} from '@vancod/types';
import { withResilience } from '@vancod/affiliate-core';
import { env } from '@vancod/config';

export class MercadoLivreConnector implements MarketplaceConnector {
  readonly name: MarketplaceName = 'mercadolivre';
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  get capabilities(): ConnectorCapabilities {
    return {
      productSearch: true,
      productDetails: true,
      price: true,
      affiliateLink: Boolean(env.MERCADOLIVRE_AFFILIATE_TAG && env.MERCADOLIVRE_AFFILIATE_TAG.trim() !== ''),
      coupons: false,
      salesTracking: false
    };
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'ok',
      marketplace: this.name,
      enabled: this.enabled,
      message: this.enabled ? 'Mercado Livre Catalog API initialized' : 'Mercado Livre connector disabled',
      latencyMs: 14
    };
  }

  private getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    if (env.MERCADOLIVRE_ACCESS_TOKEN && env.MERCADOLIVRE_ACCESS_TOKEN.trim() !== '') {
      headers['Authorization'] = `Bearer ${env.MERCADOLIVRE_ACCESS_TOKEN}`;
    }

    return headers;
  }

  /**
   * Fetches live products directly from Mercado Livre catalog API.
   * Throws controlled error if API fails or returns 403 Forbidden (No fake fallbacks).
   */
  async searchProducts(input: SearchInput): Promise<NormalizedProduct[]> {
    const limit = input.limit || 5;
    const query = encodeURIComponent(input.query || 'smartphone');
    const headers = this.getRequestHeaders();

    const response = await withResilience(async () => {
      const res = await fetch(
        `https://api.mercadolibre.com/sites/MLB/search?q=${query}&limit=${limit}`,
        { headers }
      );

      if (res.status === 403) {
        throw new Error('Mercado Livre API error 403: Authentication required. Please check MERCADOLIVRE_ACCESS_TOKEN.');
      }

      if (!res.ok) {
        throw new Error(`Mercado Livre Public API HTTP Error: ${res.status} ${res.statusText}`);
      }

      return res.json();
    });

    if (response && response.results && Array.isArray(response.results)) {
      return response.results.map((item: any) => ({
        marketplace: this.name,
        externalId: item.id,
        title: item.title,
        brand: item.attributes?.find((a: any) => a.id === 'BRAND')?.value_name || undefined,
        category: item.category_id || undefined,
        description: item.title,
        imageUrl: item.thumbnail ? item.thumbnail.replace('http://', 'https://').replace('-I.jpg', '-O.jpg') : undefined,
        productUrl: item.permalink,
        rating: item.reviews?.rating_average ?? undefined,
        reviewCount: item.reviews?.total ?? undefined
      }));
    }

    return [];
  }

  async getProduct(id: string): Promise<NormalizedProduct | null> {
    const headers = this.getRequestHeaders();
    const res = await fetch(`https://api.mercadolibre.com/items/${id}`, { headers });

    if (res.status === 403) {
      throw new Error(`Mercado Livre API error 403 fetching product ${id}: Authentication required. Please check MERCADOLIVRE_ACCESS_TOKEN.`);
    }

    if (!res.ok) {
      throw new Error(`Mercado Livre API error fetching product ${id}: ${res.status} ${res.statusText}`);
    }

    const item = await res.json();
    return {
      marketplace: this.name,
      externalId: item.id,
      title: item.title,
      brand: item.attributes?.find((a: any) => a.id === 'BRAND')?.value_name || undefined,
      category: item.category_id || undefined,
      description: item.title,
      imageUrl: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : undefined,
      productUrl: item.permalink,
      rating: item.reviews?.rating_average ?? undefined,
      reviewCount: item.reviews?.total ?? undefined
    };
  }

  async getOffers(input: OfferQuery): Promise<NormalizedOffer[]> {
    if (!input.productId) {
      throw new Error('productId is required to fetch Mercado Livre offers');
    }

    const headers = this.getRequestHeaders();
    const res = await fetch(`https://api.mercadolibre.com/items/${input.productId}`, { headers });

    if (res.status === 403) {
      throw new Error(`Mercado Livre API error 403 fetching offers for product ${input.productId}: Authentication required. Please check MERCADOLIVRE_ACCESS_TOKEN.`);
    }

    if (!res.ok) {
      throw new Error(`Mercado Livre API error fetching offers for product ${input.productId}: ${res.status} ${res.statusText}`);
    }

    const item = await res.json();
    const price = item.price;
    const oldPrice = item.original_price ?? undefined;
    const discountPercent = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : undefined;

    return [
      {
        marketplace: this.name,
        externalProductId: item.id,
        price,
        oldPrice,
        discountPercent,
        currency: 'BRL',
        availability: item.status === 'active' ? 'IN_STOCK' : 'OUT_OF_STOCK',
        seller: item.seller_id ? `Vendedor ${item.seller_id}` : undefined,
        capturedAt: new Date().toISOString(),
        freeShipping: item.shipping?.free_shipping ?? false
      }
    ];
  }

  async createAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult> {
    const tag = (input.subId || env.MERCADOLIVRE_AFFILIATE_TAG || '').trim();

    if (!tag) {
      return {
        originalUrl: input.originalUrl,
        affiliateUrl: 'NOT_AVAILABLE',
        marketplace: this.name
      };
    }

    const separator = input.originalUrl.includes('?') ? '&' : '?';
    const affiliateUrl = `${input.originalUrl}${separator}matt_tool=${encodeURIComponent(tag)}`;

    return {
      originalUrl: input.originalUrl,
      affiliateUrl,
      marketplace: this.name
    };
  }
}
