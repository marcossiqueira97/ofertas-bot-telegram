import { prisma } from './index';
import { Offer, AffiliateLink, AiGeneration, TelegramPost, PriceAlert, ScheduledPost, OfferStatus } from '@prisma/client';
import { NormalizedProduct, NormalizedOffer, ScoreBreakdown, AiCopyOutput } from '@vancod/types';
import { calculatePriceHistoryMetrics } from '@vancod/affiliate-core';

export class OfferRepository {
  /**
   * INGESTION STAGE: Upserts a Product entity ONLY in PostgreSQL.
   * Does NOT create a ProductPrice snapshot.
   */
  static async upsertProductOnly(product: NormalizedProduct) {
    const marketplace = await prisma.marketplace.upsert({
      where: { slug: product.marketplace },
      update: {},
      create: {
        name: product.marketplace.toUpperCase(),
        slug: product.marketplace,
        enabled: true
      }
    });

    const dbProduct = await prisma.product.upsert({
      where: {
        marketplaceId_externalId: {
          marketplaceId: marketplace.id,
          externalId: product.externalId
        }
      },
      update: {
        title: product.title,
        brand: product.brand,
        description: product.description,
        imageUrl: product.imageUrl,
        productUrl: product.productUrl,
        rating: product.rating,
        reviewCount: product.reviewCount
      },
      create: {
        marketplaceId: marketplace.id,
        externalId: product.externalId,
        title: product.title,
        brand: product.brand,
        description: product.description,
        imageUrl: product.imageUrl,
        productUrl: product.productUrl,
        rating: product.rating,
        reviewCount: product.reviewCount
      }
    });

    return { product: dbProduct, marketplace };
  }

  /**
   * PRICE_SNAPSHOT STAGE: Creates a ProductPrice record in PostgreSQL.
   * IDEMPOTENT: Prevents duplicate snapshots for the same event ID.
   */
  static async createPriceSnapshot(productId: string, price: number, oldPrice?: number, sourceEventId?: string) {
    if (sourceEventId) {
      const existing = await prisma.productPrice.findFirst({
        where: { productId, sourceEventId }
      });
      if (existing) {
        return existing;
      }
    }

    return prisma.productPrice.create({
      data: {
        productId,
        price,
        oldPrice,
        sourceEventId
      }
    });
  }

  /**
   * Legacy helper maintained for backward compatibility.
   */
  static async upsertProductAndSnapshot(product: NormalizedProduct, price: number, oldPrice?: number, sourceEventId?: string) {
    const { product: dbProduct, marketplace } = await this.upsertProductOnly(product);
    const priceSnapshot = await this.createPriceSnapshot(dbProduct.id, price, oldPrice, sourceEventId);
    return { product: dbProduct, priceSnapshot, marketplace };
  }

  /**
   * Calculates historical price metrics using price snapshots stored in DB.
   */
  static async getHistoricalMetricsForProduct(productId: string, currentPrice: number) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const snapshots = await prisma.productPrice.findMany({
      where: {
        productId,
        capturedAt: {
          gte: ninetyDaysAgo
        }
      },
      select: {
        price: true,
        capturedAt: true
      },
      orderBy: {
        capturedAt: 'desc'
      }
    });

    return calculatePriceHistoryMetrics(
      currentPrice,
      snapshots.map((s) => ({
        price: typeof s.price === 'number' ? s.price : Number(s.price),
        capturedAt: s.capturedAt
      }))
    );
  }

  /**
   * Saves an Offer record to PostgreSQL with calculated score and status.
   * IDEMPOTENT: Prevents creating duplicate offers for the same event ID.
   */
  static async saveOffer(
    productId: string,
    offer: NormalizedOffer,
    score: ScoreBreakdown,
    sourceEventId?: string
  ): Promise<Offer> {
    if (sourceEventId) {
      const existingOffer = await prisma.offer.findFirst({
        where: {
          productId,
          sourceEventId
        }
      });

      if (existingOffer) {
        return existingOffer;
      }
    }

    let status: OfferStatus = 'PENDING';
    if (score.action === 'AUTO_PUBLISH') {
      status = 'AUTO_APPROVED';
    } else if (score.action === 'REJECT') {
      status = 'REJECTED';
    }

    return prisma.offer.create({
      data: {
        productId,
        price: offer.price,
        oldPrice: offer.oldPrice,
        discountPercent: offer.discountPercent,
        currency: offer.currency || 'BRL',
        availability: offer.availability || 'IN_STOCK',
        seller: offer.seller,
        couponCode: offer.couponCode,
        couponDiscount: offer.couponDiscount,
        freeShipping: offer.freeShipping || false,
        score: score.totalScore,
        status,
        sourceEventId
      }
    });
  }

  /**
   * Finds offers requiring manual review (PENDING status).
   */
  static async findPendingReviewOffers() {
    return prisma.offer.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        product: {
          include: {
            marketplace: true
          }
        },
        affiliateLinks: true,
        aiGenerations: true
      },
      orderBy: {
        capturedAt: 'desc'
      }
    });
  }

  /**
   * Updates an offer status (e.g., MANUALLY_APPROVED or REJECTED).
   */
  static async updateOfferStatus(
    offerId: string,
    status: OfferStatus,
    rejectionReason?: string
  ): Promise<Offer> {
    return prisma.offer.update({
      where: { id: offerId },
      data: {
        status,
        rejectionReason
      }
    });
  }

  /**
   * Persists generated affiliate link in DB.
   * IDEMPOTENT: Prevents duplicate links for the same offer and affiliateUrl.
   */
  static async saveAffiliateLink(
    offerId: string,
    originalUrl: string,
    affiliateUrl: string,
    subId?: string
  ): Promise<AffiliateLink> {
    const existing = await prisma.affiliateLink.findFirst({
      where: {
        offerId,
        affiliateUrl
      }
    });

    if (existing) {
      return existing;
    }

    return prisma.affiliateLink.create({
      data: {
        offerId,
        originalUrl,
        affiliateUrl,
        subId
      }
    });
  }

  /**
   * Persists AI Generation copy details.
   */
  static async saveAiGeneration(
    offerId: string,
    provider: string,
    promptUsed: string,
    copy: AiCopyOutput
  ): Promise<AiGeneration> {
    return prisma.aiGeneration.create({
      data: {
        offerId,
        provider,
        promptUsed,
        headline: copy.headline,
        body: copy.body,
        cta: copy.cta,
        riskFlags: copy.riskFlags || []
      }
    });
  }

  /**
   * Persists Telegram publication record.
   */
  static async saveTelegramPost(
    offerId: string,
    channelIdentifier: string,
    headline: string,
    body: string,
    ctaUrl: string,
    messageId?: number,
    status: 'PUBLISHED' | 'NOT_CONFIGURED' | 'FAILED' | 'SKIPPED' = 'PUBLISHED'
  ): Promise<TelegramPost> {
    const channel = await prisma.telegramChannel.upsert({
      where: { channelId: channelIdentifier },
      update: {},
      create: {
        channelId: channelIdentifier,
        title: 'Vancod Ofertas Telegram Channel',
        username: channelIdentifier.startsWith('@') ? channelIdentifier.slice(1) : undefined
      }
    });

    return prisma.telegramPost.create({
      data: {
        offerId,
        channelId: channel.id,
        messageId,
        headline,
        body,
        ctaUrl,
        status
      }
    });
  }

  // --- Price Alerts ---

  static async createPriceAlert(offerId: string, targetPrice: number): Promise<PriceAlert> {
    return prisma.priceAlert.create({
      data: {
        offerId,
        targetPrice
      }
    });
  }

  static async findPriceAlerts() {
    return prisma.priceAlert.findMany({
      include: {
        offer: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  static async deletePriceAlert(id: string): Promise<PriceAlert> {
    return prisma.priceAlert.delete({
      where: { id }
    });
  }

  // --- Scheduled Posts ---

  static async createScheduledPost(
    offerId: string,
    channelIdentifier: string,
    scheduledAt: Date
  ): Promise<ScheduledPost> {
    const channel = await prisma.telegramChannel.upsert({
      where: { channelId: channelIdentifier },
      update: {},
      create: {
        channelId: channelIdentifier,
        title: 'Vancod Ofertas Telegram Channel',
        username: channelIdentifier.startsWith('@') ? channelIdentifier.slice(1) : undefined
      }
    });

    return prisma.scheduledPost.create({
      data: {
        offerId,
        channelId: channel.id,
        scheduledAt,
        status: 'SCHEDULED'
      }
    });
  }

  static async findScheduledPosts() {
    return prisma.scheduledPost.findMany({
      include: {
        offer: {
          include: {
            product: true
          }
        },
        channel: true
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });
  }

  static async deleteScheduledPost(id: string): Promise<ScheduledPost> {
    return prisma.scheduledPost.delete({
      where: { id }
    });
  }
}
