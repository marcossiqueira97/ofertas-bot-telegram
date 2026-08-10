import {
  MarketplaceConnector,
  MarketplaceName,
  ConnectorHealth,
  SearchInput,
  NormalizedProduct,
  OfferQuery,
  NormalizedOffer,
  AffiliateLinkInput,
  AffiliateLinkResult
} from '@vancod/types';
import { env } from '@vancod/config';

export class AliexpressConnector implements MarketplaceConnector {
  readonly name: MarketplaceName = 'aliexpress';
  private enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'ok',
      marketplace: this.name,
      enabled: this.enabled,
      message: this.enabled ? 'AliExpress API ready' : 'AliExpress operating in Mock mode',
      latencyMs: 15
    };
  }

  async searchProducts(input: SearchInput): Promise<NormalizedProduct[]> {
    const limit = input.limit || 5;
    return [
      {
        marketplace: this.name,
        externalId: 'ali-2001',
        title: 'Mini Projetor Portátil Magcubic HY300 4K Android 11 Wi-Fi 6',
        brand: 'Magcubic',
        category: 'Projetores',
        description: 'Projetor LED inteligente portátil com alto-falante integrado e rotação 180°.',
        imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
        productUrl: 'https://aliexpress.com/item/10050012345.html',
        rating: 4.9,
        reviewCount: 5200
      },
      {
        marketplace: this.name,
        externalId: 'ali-2002',
        title: 'Teclado Mecânico Gamer RGB 60% Switches Azuis Hot-Swap',
        brand: 'Maching',
        category: 'Periféricos',
        description: 'Teclado mecânico compacto retroiluminado RGB com cabo Type-C removível.',
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
        productUrl: 'https://aliexpress.com/item/10050067890.html',
        rating: 4.8,
        reviewCount: 3400
      }
    ].slice(0, limit);
  }

  async getProduct(id: string): Promise<NormalizedProduct | null> {
    const products = await this.searchProducts({ limit: 10 });
    return products.find((p) => p.externalId === id) || null;
  }

  async getOffers(input: OfferQuery): Promise<NormalizedOffer[]> {
    const productId = input.productId || 'ali-2001';
    if (productId === 'ali-2002') {
      return [
        {
          marketplace: this.name,
          externalProductId: productId,
          price: 129.9,
          oldPrice: 289.0,
          discountPercent: 55,
          currency: 'BRL',
          availability: 'IN_STOCK',
          seller: 'Maching Official Store',
          capturedAt: new Date().toISOString(),
          couponCode: 'ALIEXPRESS10',
          couponDiscount: 'R$ 10 OFF',
          freeShipping: true
        }
      ];
    }

    return [
      {
        marketplace: this.name,
        externalProductId: productId,
        price: 219.0,
        oldPrice: 499.0,
        discountPercent: 56,
        currency: 'BRL',
        availability: 'IN_STOCK',
        seller: 'Magcubic Official Store',
        capturedAt: new Date().toISOString(),
        couponCode: 'ALIEXPRESS15',
        couponDiscount: 'R$ 15 OFF',
        freeShipping: true
      }
    ];
  }

  async createAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult> {
    const trackingId = input.subId || env.ALIEXPRESS_TRACKING_ID || 'vancod_ali_aff';
    const affiliateUrl = `https://s.click.aliexpress.com/e/_${trackingId}`;
    return {
      originalUrl: input.originalUrl,
      affiliateUrl,
      marketplace: this.name
    };
  }
}
