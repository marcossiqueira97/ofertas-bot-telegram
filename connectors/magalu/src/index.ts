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

export class MagaluConnector implements MarketplaceConnector {
  readonly name: MarketplaceName = 'magalu';
  private enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'ok',
      marketplace: this.name,
      enabled: this.enabled,
      message: this.enabled ? 'Magalu API ready' : 'Magalu operating in Mock mode',
      latencyMs: 16
    };
  }

  async searchProducts(input: SearchInput): Promise<NormalizedProduct[]> {
    const limit = input.limit || 5;
    return [
      {
        marketplace: this.name,
        externalId: 'mgl-5001',
        title: 'Smart TV 50" 4K UHD Samsung Crystal CU7700 Wi-Fi Bluetooth',
        brand: 'Samsung',
        category: 'TV e Vídeo',
        description: 'Smart TV 50 polegadas 4K com processador Crystal 4K, Gaming Hub e Alexa integrada.',
        imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
        productUrl: 'https://magazineluiza.com.br/p/mgl-5001',
        rating: 4.8,
        reviewCount: 4200
      }
    ].slice(0, limit);
  }

  async getProduct(id: string): Promise<NormalizedProduct | null> {
    const products = await this.searchProducts({ limit: 10 });
    return products.find((p) => p.externalId === id) || null;
  }

  async getOffers(input: OfferQuery): Promise<NormalizedOffer[]> {
    return [
      {
        marketplace: this.name,
        externalProductId: input.productId || 'mgl-5001',
        price: 2199.0,
        oldPrice: 2999.0,
        discountPercent: 26,
        currency: 'BRL',
        availability: 'IN_STOCK',
        seller: 'Magazine Luiza',
        capturedAt: new Date().toISOString(),
        couponCode: 'MAGALU200',
        couponDiscount: 'R$ 200 OFF',
        freeShipping: true
      }
    ];
  }

  async createAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult> {
    const storeName = env.MAGALU_STORE_NAME || 'magazinevancod';
    const productId = input.subId || 'mgl-5001';
    const affiliateUrl = `https://www.magazinevoce.com.br/${storeName}/p/${productId}`;
    return {
      originalUrl: input.originalUrl,
      affiliateUrl,
      marketplace: this.name
    };
  }
}
