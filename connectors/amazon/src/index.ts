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
import { env } from '@vancod/config';

export class AmazonConnector implements MarketplaceConnector {
  readonly name: MarketplaceName = 'amazon';
  readonly capabilities: ConnectorCapabilities = {
    productSearch: true,
    productDetails: true,
    price: true,
    affiliateLink: false,
    coupons: false,
    salesTracking: false
  };
  private enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'ok',
      marketplace: this.name,
      enabled: this.enabled,
      message: this.enabled ? 'Amazon Creators PA-API configured' : 'Amazon operating in explicit Mock mode',
      latencyMs: 18
    };
  }

  async searchProducts(input: SearchInput): Promise<NormalizedProduct[]> {
    const limit = input.limit || 5;
    return [
      {
        marketplace: this.name,
        externalId: 'B09B2W722X',
        title: '[Mock] Echo Dot 5ª Geração com Alexa | Smart Speaker',
        brand: 'Amazon',
        category: 'Dispositivos Amazon',
        description: 'O Echo Dot com o melhor som já lançado e controle por voz para casa inteligente.',
        imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',
        productUrl: 'https://amazon.com.br/dp/B09B2W722X',
        rating: undefined,
        reviewCount: undefined
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
        externalProductId: input.productId || 'B09B2W722X',
        price: 269.1,
        oldPrice: undefined,
        discountPercent: undefined,
        currency: 'BRL',
        availability: 'IN_STOCK',
        seller: 'Amazon.com.br',
        capturedAt: new Date().toISOString(),
        freeShipping: true
      }
    ];
  }

  async createAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult> {
    const associateTag = input.subId || env.AMAZON_ASSOCIATE_TAG || 'vancod-20';
    const affiliateUrl = `${input.originalUrl}?tag=${associateTag}`;

    return {
      originalUrl: input.originalUrl,
      affiliateUrl,
      marketplace: this.name
    };
  }
}
