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

export class ShopeeConnector implements MarketplaceConnector {
  readonly name: MarketplaceName = 'shopee';
  private enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: 'ok',
      marketplace: this.name,
      enabled: this.enabled,
      message: this.enabled ? 'Shopee Official API Adapter configured' : 'Shopee operating in explicit Mock mode',
      latencyMs: 12
    };
  }

  async searchProducts(input: SearchInput): Promise<NormalizedProduct[]> {
    const limit = input.limit || 5;
    const mockProducts: NormalizedProduct[] = [
      {
        marketplace: this.name,
        externalId: 'shp-1001',
        title: '[Mock] Fone de Ouvido Bluetooth Sem Fio TWS i12 Premium',
        brand: 'TWS',
        category: 'Eletrônicos',
        description: 'Fone de ouvido sem fio com cancelamento de ruído e case de carregamento rápido.',
        imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
        productUrl: 'https://shopee.com.br/product/123/1001',
        rating: undefined,
        reviewCount: undefined
      },
      {
        marketplace: this.name,
        externalId: 'shp-1002',
        title: '[Mock] Smartwatch Relógio Inteligente D20 Y68 Monitor Cardíaco',
        brand: 'SmartWatch',
        category: 'Wearables',
        description: 'Relógio inteligente com monitoramento de saúde, passos e notificações do celular.',
        imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
        productUrl: 'https://shopee.com.br/product/123/1002',
        rating: undefined,
        reviewCount: undefined
      }
    ];

    return mockProducts.slice(0, limit);
  }

  async getProduct(id: string): Promise<NormalizedProduct | null> {
    const products = await this.searchProducts({ limit: 10 });
    return products.find((p) => p.externalId === id) || null;
  }

  async getOffers(input: OfferQuery): Promise<NormalizedOffer[]> {
    const productId = input.productId || 'shp-1001';
    return [
      {
        marketplace: this.name,
        externalProductId: productId,
        price: 39.9,
        oldPrice: undefined,
        discountPercent: undefined,
        currency: 'BRL',
        availability: 'IN_STOCK',
        seller: 'Loja Oficial Shopee',
        capturedAt: new Date().toISOString(),
        couponCode: undefined,
        couponDiscount: undefined,
        freeShipping: true
      }
    ];
  }

  async createAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult> {
    const affiliateId = input.subId || env.SHOPEE_AFFILIATE_ID || 'vancod_shopee_aff';
    const affiliateUrl = `${input.originalUrl}?shopee_affiliate_id=${affiliateId}`;

    return {
      originalUrl: input.originalUrl,
      affiliateUrl,
      marketplace: this.name
    };
  }
}
