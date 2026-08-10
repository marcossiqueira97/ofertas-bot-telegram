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

export class MagaluConnector implements MarketplaceConnector {
  readonly name: MarketplaceName = 'magalu';
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
      message: this.enabled ? 'Magalu Magazine Você Store API configured' : 'Magalu operating in explicit Mock mode',
      latencyMs: 16
    };
  }

  async searchProducts(input: SearchInput): Promise<NormalizedProduct[]> {
    const limit = input.limit || 5;
    return [
      {
        marketplace: this.name,
        externalId: 'mgl-5001',
        title: '[Mock] Smart TV 50" 4K UHD Samsung Crystal CU7700 Wi-Fi Bluetooth',
        brand: 'Samsung',
        category: 'TV e Vídeo',
        description: 'Smart TV 50 polegadas 4K com processador Crystal 4K, Gaming Hub e Alexa integrada.',
        imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
        productUrl: 'https://magazineluiza.com.br/p/mgl-5001',
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
        externalProductId: input.productId || 'mgl-5001',
        price: 2199.0,
        oldPrice: undefined,
        discountPercent: undefined,
        currency: 'BRL',
        availability: 'IN_STOCK',
        seller: 'Magazine Luiza',
        capturedAt: new Date().toISOString(),
        couponCode: undefined,
        couponDiscount: undefined,
        freeShipping: true
      }
    ];
  }

  /**
   * Link de afiliado Magazine Você.
   * Se MAGALU_STORE_NAME estiver configurado nas ENVs, gera a URL da loja do parceiro.
   */
  async createAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult> {
    const storeName = env.MAGALU_STORE_NAME;
    const productId = input.subId || 'mgl-5001';
    const affiliateUrl = storeName
      ? `https://www.magazinevoce.com.br/${storeName}/p/${productId}`
      : input.originalUrl;

    return {
      originalUrl: input.originalUrl,
      affiliateUrl,
      marketplace: this.name
    };
  }
}
