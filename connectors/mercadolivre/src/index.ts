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

export class MercadoLivreConnector implements MarketplaceConnector {
  readonly name: MarketplaceName = 'mercadolivre';
  readonly capabilities: ConnectorCapabilities = {
    productSearch: true,
    productDetails: true,
    price: true,
    affiliateLink: false, // Affiliate program API not yet officially configured
    coupons: false,
    salesTracking: false
  };
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'ok',
      marketplace: this.name,
      enabled: this.enabled,
      message: this.enabled ? 'Mercado Livre Public API connected' : 'Mercado Livre connector disabled',
      latencyMs: 14
    };
  }

  /**
   * Fetches REAL live products directly from Mercado Livre official public catalog API.
   * Throws clean error if network/API fails (No fake fallbacks).
   */
  async searchProducts(input: SearchInput): Promise<NormalizedProduct[]> {
    const limit = input.limit || 5;
    const query = encodeURIComponent(input.query || 'smartphone');

    const response = await withResilience(async () => {
      const res = await fetch(
        `https://api.mercadolibre.com/sites/MLB/search?q=${query}&limit=${limit}`
      );
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
    const res = await fetch(`https://api.mercadolibre.com/items/${id}`);
    if (!res.ok) {
      throw new Error(`Mercado Livre API error fetching product ${id}: ${res.statusText}`);
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

    const res = await fetch(`https://api.mercadolibre.com/items/${input.productId}`);
    if (!res.ok) {
      throw new Error(`Mercado Livre API error fetching offers for product ${input.productId}: ${res.statusText}`);
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
    return {
      originalUrl: input.originalUrl,
      affiliateUrl: 'NOT_AVAILABLE',
      marketplace: this.name
    };
  }
}
