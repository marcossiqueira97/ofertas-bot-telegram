import { describe, it, expect } from 'vitest';
import {
  validateProductUrl,
  calculatePriceHistoryMetrics,
  calculateOfferScore,
  generateProductDeduplicationKey
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
    it('should correctly identify historical low', () => {
      const snapshots = [
        { price: 100, capturedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { price: 120, capturedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
      ];
      const metrics = calculatePriceHistoryMetrics(80, snapshots);
      expect(metrics.isHistoricalLow).toBe(true);
      expect(metrics.lowestPrice7d).toBe(100);
      expect(metrics.averagePrice30d).toBe(110);
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
});
