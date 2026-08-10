import { describe, it, expect } from 'vitest';
import {
  validateProductUrl,
  calculatePriceHistoryMetrics,
  calculateOfferScore,
  generateProductDeduplicationKey,
  validateOfferPolicy
} from './index';

describe('Affiliate Core Unit Tests', () => {
  describe('validateProductUrl', () => {
    it('should approve valid marketplace URLs', () => {
      const res = validateProductUrl('https://shopee.com.br/product/123/456');
      expect(res.passed).toBe(true);
      expect(res.violations).toHaveLength(0);
    });

    it('should reject loopback/private IP addresses (SSRF)', () => {
      const res = validateProductUrl('http://127.0.0.1:8080/admin');
      expect(res.passed).toBe(false);
      expect(res.violations).toContain('URL targets private/loopback network (SSRF protection)');
    });

    it('should reject unallowed domain hostnames', () => {
      const res = validateProductUrl('https://malicious-site.com/offer');
      expect(res.passed).toBe(false);
      expect(res.violations[0]).toContain('not in the allowed marketplace list');
    });
  });

  describe('calculatePriceHistoryMetrics', () => {
    it('should return isHistoricalLow = false when history is empty', () => {
      const metrics = calculatePriceHistoryMetrics(100, []);
      expect(metrics.isHistoricalLow).toBe(false);
    });

    it('should return isHistoricalLow = true when current price (100) is strictly lower than previous snapshots (150, 120, 110)', () => {
      const snapshots = [
        { price: 150, capturedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { price: 120, capturedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
        { price: 110, capturedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) }
      ];
      const metrics = calculatePriceHistoryMetrics(100, snapshots);
      expect(metrics.isHistoricalLow).toBe(true);
      expect(metrics.lowestPrice30d).toBe(110);
    });

    it('should return isHistoricalLow = false when current price (100) is greater than previous minimum (90)', () => {
      const snapshots = [
        { price: 90, capturedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { price: 100, capturedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
        { price: 110, capturedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) }
      ];
      const metrics = calculatePriceHistoryMetrics(100, snapshots);
      expect(metrics.isHistoricalLow).toBe(false);
    });

    it('should return isHistoricalLow = false when current price (100) is equal to previous minimum (100)', () => {
      const snapshots = [
        { price: 100, capturedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { price: 110, capturedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
      ];
      const metrics = calculatePriceHistoryMetrics(100, snapshots);
      expect(metrics.isHistoricalLow).toBe(false);
    });
  });

  describe('calculateOfferScore', () => {
    it('should score high discount, free shipping and 5-star rating as AUTO_PUBLISH', () => {
      const score = calculateOfferScore(
        {
          marketplace: 'shopee',
          externalProductId: 'p123',
          price: 49.9,
          oldPrice: 149.9,
          discountPercent: 66,
          currency: 'BRL',
          freeShipping: true,
          capturedAt: new Date().toISOString()
        },
        5.0,
        1500,
        { isHistoricalLow: true }
      );

      expect(score.totalScore).toBeGreaterThanOrEqual(85);
      expect(score.action).toBe('AUTO_PUBLISH');
    });
  });

  describe('generateProductDeduplicationKey', () => {
    it('should generate consistent deduplication keys', () => {
      const key = generateProductDeduplicationKey('Shopee ', ' 12345 ');
      expect(key).toBe('shopee:12345');
    });
  });

  describe('validateOfferPolicy', () => {
    it('should block offer if affiliateUrl is NOT_AVAILABLE or missing', () => {
      const res = validateOfferPolicy({
        price: 99.9,
        marketplace: 'shopee',
        affiliateUrl: 'NOT_AVAILABLE'
      });
      expect(res.passed).toBe(false);
      expect(res.violations).toContain('Valid affiliate URL is required for automatic publication');
    });

    it('should block offer if copy claims discount without verified discount evidence', () => {
      const res = validateOfferPolicy({
        price: 99.9,
        marketplace: 'shopee',
        affiliateUrl: 'https://aff.shopee.com/123',
        headline: '🔥 OFERTA IMPERDÍVEL: Produto X (50% OFF)'
      });
      expect(res.passed).toBe(false);
      expect(res.violations).toContain('Copy claims discount but offer has no verified discount evidence');
    });

    it('should block offer if copy claims historical low without historical price evidence', () => {
      const res = validateOfferPolicy({
        price: 99.9,
        marketplace: 'shopee',
        affiliateUrl: 'https://aff.shopee.com/123',
        isHistoricalLow: false,
        headline: '🔥 Menor preço histórico no Produto X'
      });
      expect(res.passed).toBe(false);
      expect(res.violations).toContain('Copy claims historical low price without verified historical price evidence');
    });

    it('should block offer if copy claims coupon without couponCode', () => {
      const res = validateOfferPolicy({
        price: 99.9,
        marketplace: 'shopee',
        affiliateUrl: 'https://aff.shopee.com/123',
        headline: '🔥 Produto X com Cupom Especial'
      });
      expect(res.passed).toBe(false);
      expect(res.violations).toContain('Copy claims coupon but offer has no verified coupon code');
    });

    it('should block offer if copy claims free shipping without freeShipping confirmation', () => {
      const res = validateOfferPolicy({
        price: 99.9,
        marketplace: 'shopee',
        affiliateUrl: 'https://aff.shopee.com/123',
        freeShipping: false,
        headline: '🔥 Produto X com Frete Grátis'
      });
      expect(res.passed).toBe(false);
      expect(res.violations).toContain('Copy claims free shipping but offer has no verified free shipping confirmation');
    });

    it('should pass offer when all claims are backed by evidence and valid affiliate URL', () => {
      const res = validateOfferPolicy({
        price: 49.9,
        oldPrice: 99.9,
        discountPercent: 50,
        marketplace: 'shopee',
        affiliateUrl: 'https://aff.shopee.com/123',
        freeShipping: true,
        couponCode: 'DESCONTO10',
        isHistoricalLow: true,
        headline: '🔥 OFERTA IMPERDÍVEL: Produto X (50% OFF)',
        body: 'Por R$ 49.90 com Frete Grátis e Cupom DESCONTO10. Menor preço histórico!'
      });
      expect(res.passed).toBe(true);
      expect(res.violations).toHaveLength(0);
    });
  });
});

