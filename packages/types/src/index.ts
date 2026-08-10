export type MarketplaceName = 'shopee' | 'aliexpress' | 'amazon' | 'mercadolivre' | 'magalu' | 'mock';

export interface NormalizedProduct {
  marketplace: MarketplaceName;
  externalId: string;
  title: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  productUrl: string;
  rating?: number;
  reviewCount?: number;
}

export interface NormalizedOffer {
  marketplace: MarketplaceName;
  externalProductId: string;
  price: number;
  currency: string;
  oldPrice?: number;
  discountPercent?: number;
  availability?: string;
  seller?: string;
  affiliateUrl?: string;
  capturedAt: string;
  couponCode?: string;
  couponDiscount?: string;
  freeShipping?: boolean;
}

export type IntegrationStatus =
  | 'MOCK'
  | 'CONFIGURED'
  | 'AUTHENTICATED'
  | 'ACTIVE'
  | 'ERROR'
  | 'DISABLED';

export interface MarketplaceIntegrationDetail {
  marketplace: MarketplaceName;
  connector: 'ok' | 'warning' | 'error';
  credentials: 'ok' | 'warning' | 'error';
  api: 'ok' | 'warning' | 'error';
  affiliate: 'ok' | 'warning' | 'error';
  publishing: 'ok' | 'warning' | 'error';
  status: IntegrationStatus;
  statusLabel: string;
}

export interface ConnectorHealth {
  status: 'ok' | 'degraded' | 'error';
  marketplace: MarketplaceName;
  enabled: boolean;
  message?: string;
  latencyMs?: number;
}

export interface SearchInput {
  query?: string;
  category?: string;
  limit?: number;
  minDiscountPercent?: number;
}

export interface OfferQuery {
  productId?: string;
  externalId?: string;
}

export interface AffiliateLinkInput {
  originalUrl: string;
  subId?: string;
  couponCode?: string;
}

export interface AffiliateLinkResult {
  originalUrl: string;
  affiliateUrl: string;
  marketplace: MarketplaceName;
}

export interface ConnectorCapabilities {
  productSearch: boolean;
  productDetails: boolean;
  price: boolean;
  affiliateLink: boolean;
  coupons: boolean;
  salesTracking: boolean;
}

export interface MarketplaceConnector {
  readonly name: MarketplaceName;
  readonly capabilities?: ConnectorCapabilities;
  healthCheck(): Promise<ConnectorHealth>;
  searchProducts(input: SearchInput): Promise<NormalizedProduct[]>;
  getProduct(id: string): Promise<NormalizedProduct | null>;
  getOffers(input: OfferQuery): Promise<NormalizedOffer[]>;
  createAffiliateLink?(input: AffiliateLinkInput): Promise<AffiliateLinkResult>;
}

export interface AiCopyInput {
  title: string;
  price: number;
  oldPrice?: number;
  discountPercent?: number;
  rating?: number;
  reviewCount?: number;
  shipping?: string;
  coupon?: string;
  historicalEvidence?: string;
  category?: string;
  marketplace: string;
}

export interface AiCopyOutput {
  headline: string;
  body: string;
  cta: string;
  riskFlags: string[];
}

export interface PriceHistoryMetrics {
  lowestPrice7d?: number;
  lowestPrice30d?: number;
  lowestPrice90d?: number;
  averagePrice30d?: number;
  currentVsAveragePercent?: number;
  isHistoricalLow: boolean;
}

export interface ScoreBreakdown {
  realDiscountScore: number;     // max 30
  historyScore: number;          // max 20
  absolutePriceScore: number;    // max 15
  ratingScore: number;           // max 10
  reviewVolumeScore: number;     // max 10
  commissionScore: number;       // max 5
  popularityScore: number;       // max 5
  shippingScore: number;         // max 5
  totalScore: number;            // max 100
  action: 'AUTO_PUBLISH' | 'MANUAL_REVIEW' | 'REJECT';
}

export interface PolicyCheckResult {
  passed: boolean;
  violations: string[];
  sanitizedUrl?: string;
}
