import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfferRepository } from './offer-repository';
import { prisma } from './index';
import { Prisma } from '@prisma/client';

vi.mock('./index', () => {
  return {
    prisma: {
      marketplace: {
        upsert: vi.fn()
      },
      product: {
        upsert: vi.fn()
      },
      productPrice: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      offer: {
        create: vi.fn(),
        findFirst: vi.fn()
      },
      affiliateLink: {
        create: vi.fn(),
        findFirst: vi.fn()
      },
      aiGeneration: {
        create: vi.fn()
      },
      telegramChannel: {
        upsert: vi.fn()
      },
      telegramPost: {
        create: vi.fn(),
        findFirst: vi.fn()
      }
    }
  };
});

describe('OfferRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert product and price snapshot', async () => {
    vi.mocked(prisma.marketplace.upsert).mockResolvedValue({
      id: 'mkt-1',
      name: 'SHOPEE',
      slug: 'shopee',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    vi.mocked(prisma.product.upsert).mockResolvedValue({
      id: 'prod-1',
      marketplaceId: 'mkt-1',
      externalId: 'shp-1001',
      title: 'Fone Bluetooth',
      brand: 'TWS',
      categoryId: null,
      description: 'Fone de ouvido sem fio',
      imageUrl: 'https://shopee.com.br/img.jpg',
      productUrl: 'https://shopee.com.br/product/1',
      rating: 4.8,
      reviewCount: 2000,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    vi.mocked(prisma.productPrice.create).mockResolvedValue({
      id: 'price-1',
      productId: 'prod-1',
      price: new Prisma.Decimal(39.9),
      oldPrice: new Prisma.Decimal(99.9),
      currency: 'BRL',
      sourceEventId: null,
      capturedAt: new Date()
    });

    const result = await OfferRepository.upsertProductAndSnapshot(
      {
        marketplace: 'shopee',
        externalId: 'shp-1001',
        title: 'Fone Bluetooth',
        productUrl: 'https://shopee.com.br/product/1'
      },
      39.9,
      99.9
    );

    expect(result.product.id).toBe('prod-1');
    expect(prisma.marketplace.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.product.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.productPrice.create).toHaveBeenCalledTimes(1);
  });

  it('should prevent duplicate ProductPrice for the same sourceEventId', async () => {
    const existingSnapshot = {
      id: 'price-100',
      productId: 'prod-1',
      price: new Prisma.Decimal(50.0),
      oldPrice: null,
      currency: 'BRL',
      sourceEventId: 'event-123',
      capturedAt: new Date()
    };

    vi.mocked(prisma.productPrice.findFirst).mockResolvedValue(existingSnapshot);

    const snapshot = await OfferRepository.createPriceSnapshot('prod-1', 50.0, undefined, 'event-123');

    expect(snapshot.id).toBe('price-100');
    expect(prisma.productPrice.findFirst).toHaveBeenCalledWith({
      where: { productId: 'prod-1', sourceEventId: 'event-123' }
    });
    expect(prisma.productPrice.create).not.toHaveBeenCalled();
  });

  it('should prevent duplicate Offer for the same sourceEventId', async () => {
    const existingOffer = {
      id: 'offer-100',
      productId: 'prod-1',
      price: new Prisma.Decimal(50.0),
      oldPrice: null,
      discountPercent: null,
      currency: 'BRL',
      availability: 'IN_STOCK',
      seller: null,
      couponCode: null,
      couponDiscount: null,
      freeShipping: true,
      score: new Prisma.Decimal(90),
      status: 'AUTO_APPROVED' as const,
      rejectionReason: null,
      sourceEventId: 'event-123',
      capturedAt: new Date(),
      updatedAt: new Date()
    };

    vi.mocked(prisma.offer.findFirst).mockResolvedValue(existingOffer);

    const offerData = {
      marketplace: 'shopee' as const,
      externalProductId: 'shp-1001',
      price: 50.0,
      currency: 'BRL',
      capturedAt: new Date().toISOString()
    };

    const scoreData = {
      realDiscountScore: 30,
      historyScore: 20,
      absolutePriceScore: 15,
      ratingScore: 10,
      reviewVolumeScore: 8,
      commissionScore: 3,
      popularityScore: 2,
      shippingScore: 2,
      totalScore: 90,
      action: 'AUTO_PUBLISH' as const
    };

    const offer = await OfferRepository.saveOffer('prod-1', offerData, scoreData, 'event-123');

    expect(offer.id).toBe('offer-100');
    expect(prisma.offer.findFirst).toHaveBeenCalledWith({
      where: { productId: 'prod-1', sourceEventId: 'event-123' }
    });
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });

  it('should prevent duplicate AffiliateLink for the same offerId and affiliateUrl', async () => {
    const existingLink = {
      id: 'aff-100',
      offerId: 'offer-1',
      originalUrl: 'https://shopee.com.br/product/1',
      affiliateUrl: 'https://shopee.com.br/product/1?aff=123',
      subId: null,
      createdAt: new Date()
    };

    vi.mocked(prisma.affiliateLink.findFirst).mockResolvedValue(existingLink);

    const link = await OfferRepository.saveAffiliateLink(
      'offer-1',
      'https://shopee.com.br/product/1',
      'https://shopee.com.br/product/1?aff=123'
    );

    expect(link.id).toBe('aff-100');
    expect(prisma.affiliateLink.create).not.toHaveBeenCalled();
  });
});
