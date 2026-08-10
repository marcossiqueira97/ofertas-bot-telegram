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
        findMany: vi.fn()
      },
      offer: {
        create: vi.fn()
      },
      affiliateLink: {
        create: vi.fn()
      },
      aiGeneration: {
        create: vi.fn()
      },
      telegramChannel: {
        upsert: vi.fn()
      },
      telegramPost: {
        create: vi.fn()
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

  it('should save offer with AUTO_APPROVED status for score >= 85', async () => {
    vi.mocked(prisma.offer.create).mockResolvedValue({
      id: 'offer-1',
      productId: 'prod-1',
      price: new Prisma.Decimal(39.9),
      oldPrice: new Prisma.Decimal(99.9),
      discountPercent: new Prisma.Decimal(60),
      currency: 'BRL',
      availability: 'IN_STOCK',
      seller: 'Loja',
      couponCode: null,
      couponDiscount: null,
      freeShipping: true,
      score: new Prisma.Decimal(88),
      status: 'AUTO_APPROVED',
      rejectionReason: null,
      capturedAt: new Date(),
      updatedAt: new Date()
    });

    const offerData = {
      marketplace: 'shopee' as const,
      externalProductId: 'shp-1001',
      price: 39.9,
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
      shippingScore: 0,
      totalScore: 88,
      action: 'AUTO_PUBLISH' as const
    };

    const created = await OfferRepository.saveOffer('prod-1', offerData, scoreData);

    expect(created.status).toBe('AUTO_APPROVED');
    expect(prisma.offer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'AUTO_APPROVED',
          score: 88
        })
      })
    );
  });
});
