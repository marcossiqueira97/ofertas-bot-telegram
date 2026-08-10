import {
  NormalizedOffer,
  PriceHistoryMetrics,
  ScoreBreakdown,
  PolicyCheckResult
} from '@vancod/types';

export * from './resilient-fetch';
export * from './connector-registry';



const ALLOWED_HOSTNAMES = [
  'shopee.com.br',
  'shope.ee',
  'aliexpress.com',
  's.click.aliexpress.com',
  'amazon.com.br',
  'amzn.to',
  'mercadolivre.com.br',
  'mercadolibre.com',
  'magazineluiza.com.br',
  'magalu.com'
];

/**
 * Validates product URL against SSRF threats and domain allowlist.
 */
export function validateProductUrl(urlStr: string): PolicyCheckResult {
  const violations: string[] = [];

  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      violations.push('URL protocol must be HTTP or HTTPS');
    }

    const host = parsed.hostname.toLowerCase();

    const isLoopbackOrPrivate =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.endsWith('.local') ||
      host.endsWith('.internal');

    if (isLoopbackOrPrivate) {
      violations.push('URL targets private/loopback network (SSRF protection)');
    }

    const isAllowedHost = ALLOWED_HOSTNAMES.some(
      (allowed) => host === allowed || host.endsWith('.' + allowed)
    );

    if (!isAllowedHost) {
      violations.push(`Hostname '${host}' is not in the allowed marketplace list`);
    }

    return {
      passed: violations.length === 0,
      violations,
      sanitizedUrl: violations.length === 0 ? parsed.toString() : undefined
    };
  } catch (err) {
    return {
      passed: false,
      violations: ['Invalid URL format']
    };
  }
}

/**
 * Calculates historical price metrics from price snapshots.
 */
export function calculatePriceHistoryMetrics(
  currentPrice: number,
  priceSnapshots: { price: number; capturedAt: Date | string }[]
): PriceHistoryMetrics {
  if (!priceSnapshots || priceSnapshots.length === 0) {
    return {
      isHistoricalLow: false
    };
  }

  const now = new Date();
  const getDaysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const d7 = getDaysAgo(7);
  const d30 = getDaysAgo(30);
  const d90 = getDaysAgo(90);

  const prices7d = priceSnapshots
    .filter((s) => new Date(s.capturedAt) >= d7)
    .map((s) => s.price);
  const prices30d = priceSnapshots
    .filter((s) => new Date(s.capturedAt) >= d30)
    .map((s) => s.price);
  const prices90d = priceSnapshots
    .filter((s) => new Date(s.capturedAt) >= d90)
    .map((s) => s.price);

  const lowestPrice7d = prices7d.length > 0 ? Math.min(...prices7d) : undefined;
  const lowestPrice30d = prices30d.length > 0 ? Math.min(...prices30d) : undefined;
  const lowestPrice90d = prices90d.length > 0 ? Math.min(...prices90d) : undefined;

  const averagePrice30d =
    prices30d.length > 0
      ? prices30d.reduce((acc, p) => acc + p, 0) / prices30d.length
      : undefined;

  const currentVsAveragePercent = averagePrice30d
    ? ((currentPrice - averagePrice30d) / averagePrice30d) * 100
    : undefined;

  const allHistoricalPrices = priceSnapshots.map((s) => s.price);
  const globalLowest = Math.min(...allHistoricalPrices);
  const isHistoricalLow = currentPrice < globalLowest;

  return {
    lowestPrice7d,
    lowestPrice30d,
    lowestPrice90d,
    averagePrice30d,
    currentVsAveragePercent,
    isHistoricalLow
  };
}

/**
 * Calculates Offer Score (0-100) based on weighted rules defined in specification.
 */
export function calculateOfferScore(
  offer: NormalizedOffer,
  rating?: number,
  reviewCount?: number,
  historyMetrics?: PriceHistoryMetrics
): ScoreBreakdown {
  // 1. Real Discount Score (max 30)
  let realDiscountScore = 0;
  if (offer.discountPercent && offer.discountPercent > 0) {
    realDiscountScore = Math.min(30, (offer.discountPercent / 60) * 30);
  } else if (offer.oldPrice && offer.oldPrice > offer.price) {
    const discount = ((offer.oldPrice - offer.price) / offer.oldPrice) * 100;
    realDiscountScore = Math.min(30, (discount / 60) * 30);
  }

  // 2. History Score (max 20) - Sem histórico comprovado, 0 pontos
  let historyScore = 0;
  if (historyMetrics?.isHistoricalLow) {
    historyScore = 20;
  } else if (
    historyMetrics?.currentVsAveragePercent !== undefined &&
    historyMetrics.currentVsAveragePercent < 0
  ) {
    historyScore = Math.min(20, 10 + Math.abs(historyMetrics.currentVsAveragePercent) / 2);
  }

  // 3. Absolute Price Score (max 15)
  let absolutePriceScore = 10;
  if (offer.price <= 50) absolutePriceScore = 15;
  else if (offer.price <= 200) absolutePriceScore = 13;
  else if (offer.price <= 500) absolutePriceScore = 10;
  else if (offer.price <= 1500) absolutePriceScore = 7;
  else absolutePriceScore = 5;

  // 4. Rating Score (max 10) - Se não houver rating verificado, 0 pontos
  let ratingScore = 0;
  if (rating) {
    ratingScore = Math.min(10, (rating / 5) * 10);
  }

  // 5. Review Volume Score (max 10) - Se não houver volume de reviews verificado, 0 pontos
  let reviewVolumeScore = 0;
  if (reviewCount) {
    if (reviewCount > 1000) reviewVolumeScore = 10;
    else if (reviewCount > 200) reviewVolumeScore = 7;
    else if (reviewCount > 50) reviewVolumeScore = 5;
    else reviewVolumeScore = 2;
  }

  // 6. Commission Score (max 5) - Sem dados de comissão, 0 pontos
  const commissionScore = 0;

  // 7. Popularity Score (max 5) - Sem dados de popularidade, 0 pontos
  const popularityScore = 0;

  // 8. Shipping Score (max 5) - Se não houver confirmação de frete grátis, 0 pontos
  let shippingScore = 0;
  if (offer.freeShipping) {
    shippingScore = 5;
  }

  const totalScore = Math.round(
    realDiscountScore +
      historyScore +
      absolutePriceScore +
      ratingScore +
      reviewVolumeScore +
      commissionScore +
      popularityScore +
      shippingScore
  );

  let action: 'AUTO_PUBLISH' | 'MANUAL_REVIEW' | 'REJECT' = 'REJECT';
  if (totalScore >= 85) {
    action = 'AUTO_PUBLISH';
  } else if (totalScore >= 70) {
    action = 'MANUAL_REVIEW';
  }

  return {
    realDiscountScore: Math.round(realDiscountScore),
    historyScore: Math.round(historyScore),
    absolutePriceScore: Math.round(absolutePriceScore),
    ratingScore: Math.round(ratingScore),
    reviewVolumeScore: Math.round(reviewVolumeScore),
    commissionScore,
    popularityScore,
    shippingScore,
    totalScore,
    action
  };
}

/**
 * Generates a unique deduplication key for products.
 */
export function generateProductDeduplicationKey(marketplace: string, externalId: string): string {
  return `${marketplace.toLowerCase().trim()}:${externalId.trim()}`;
}

/**
 * Deterministic Policy Check before Telegram Publication.
 * Rejects offers with missing affiliate links, unverified discounts, unproven historical low claims, or unconfirmed coupons/shipping.
 */
export function validateOfferPolicy(input: {
  price: number;
  marketplace?: string;
  affiliateUrl?: string;
  isAffiliateAvailable?: boolean;
  discountPercent?: number;
  oldPrice?: number;
  couponCode?: string;
  freeShipping?: boolean;
  isHistoricalLow?: boolean;
  headline?: string;
  body?: string;
}): PolicyCheckResult {
  const violations: string[] = [];

  // 1. Price validation
  if (!input.price || input.price <= 0) {
    violations.push('Price must be greater than zero');
  }

  // 2. Marketplace validation
  if (!input.marketplace) {
    violations.push('Marketplace is required');
  }

  // 3. Affiliate URL & Capability validation
  if (!input.affiliateUrl || input.affiliateUrl === 'NOT_AVAILABLE' || input.isAffiliateAvailable === false) {
    violations.push('Valid affiliate URL is required for automatic publication');
  }

  const copyText = `${input.headline || ''} ${input.body || ''}`;

  // 4. Discount claim evidence check
  if (copyText.includes('% OFF') || copyText.toLowerCase().includes('desconto')) {
    const hasEvidence = (input.discountPercent && input.discountPercent > 0) || (input.oldPrice && input.oldPrice > input.price);
    if (!hasEvidence) {
      violations.push('Copy claims discount but offer has no verified discount evidence');
    }
  }

  // 5. Historical low claim evidence check
  if (copyText.toLowerCase().includes('menor preço histórico') || copyText.toLowerCase().includes('menor preco historico')) {
    if (!input.isHistoricalLow) {
      violations.push('Copy claims historical low price without verified historical price evidence');
    }
  }

  // 6. Coupon claim evidence check
  if (copyText.toLowerCase().includes('cupom')) {
    if (!input.couponCode) {
      violations.push('Copy claims coupon but offer has no verified coupon code');
    }
  }

  // 7. Free shipping claim evidence check
  if (copyText.toLowerCase().includes('frete grátis') || copyText.toLowerCase().includes('frete gratis')) {
    if (!input.freeShipping) {
      violations.push('Copy claims free shipping but offer has no verified free shipping confirmation');
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    sanitizedUrl: violations.length === 0 ? input.affiliateUrl : undefined
  };
}

