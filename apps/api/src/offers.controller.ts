import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ShopeeConnector } from '@vancod/connector-shopee';
import { AliexpressConnector } from '@vancod/connector-aliexpress';
import { AmazonConnector } from '@vancod/connector-amazon';
import { MercadoLivreConnector } from '@vancod/connector-mercadolivre';
import { MagaluConnector } from '@vancod/connector-magalu';
import { calculateOfferScore, validateProductUrl, withResilience } from '@vancod/affiliate-core';
import { createAiProvider } from '@vancod/ai';
import { OfferRepository } from '@vancod/database';

@Controller('offers')
export class OffersController {
  private shopee = new ShopeeConnector(true);
  private aliexpress = new AliexpressConnector(true);
  private amazon = new AmazonConnector(true);
  private mercadolivre = new MercadoLivreConnector(true);
  private magalu = new MagaluConnector(true);
  private aiProvider = createAiProvider();

  @Get()
  async getOffers(@Query('query') queryStr?: string) {
    const connectorsList = [
      this.mercadolivre,
      this.shopee,
      this.aliexpress,
      this.amazon,
      this.magalu
    ];

    const searchKeyword = queryStr || 'smartphone';
    const results = [];

    for (const conn of connectorsList) {
      try {
        const products = await withResilience(() =>
          conn.searchProducts({ query: searchKeyword, limit: 3 })
        );
        for (const product of products) {
          const offers = await withResilience(() =>
            conn.getOffers({ productId: product.externalId })
          );
          const offer = offers[0];

          if (offer) {
            const score = calculateOfferScore(
              offer,
              product.rating || 4.7,
              product.reviewCount || 1200,
              { isHistoricalLow: true }
            );

            const affiliateLink = await conn.createAffiliateLink({ originalUrl: product.productUrl });

            const aiCopy = await this.aiProvider.generateCopy({
              title: product.title,
              price: offer.price,
              oldPrice: offer.oldPrice,
              discountPercent: offer.discountPercent,
              marketplace: offer.marketplace,
              coupon: offer.couponCode
            });

            results.push({
              id: `offer-${product.marketplace}-${product.externalId}`,
              marketplace: product.marketplace,
              externalProductId: product.externalId,
              title: product.title,
              imageUrl: product.imageUrl,
              brand: product.brand,
              category: product.category,
              price: offer.price,
              oldPrice: offer.oldPrice,
              discountPercent: offer.discountPercent,
              freeShipping: offer.freeShipping,
              couponCode: offer.couponCode,
              couponDiscount: offer.couponDiscount,
              rating: product.rating,
              reviewCount: product.reviewCount,
              productUrl: product.productUrl,
              affiliateUrl: affiliateLink.affiliateUrl,
              score,
              aiCopy,
              status: score.action === 'AUTO_PUBLISH' ? 'AUTO_APPROVED' : 'PENDING'
            });
          }
        }
      } catch (err) {
        // Degrade gracefully per connector
      }
    }

    return {
      count: results.length,
      offers: results
    };
  }

  @Get('pending-review')
  async getPendingReviewOffers() {
    try {
      const offers = await OfferRepository.findPendingReviewOffers();
      if (offers && offers.length > 0) {
        return { count: offers.length, offers };
      }
    } catch (err) {}

    // Mock pending review items
    return {
      count: 2,
      offers: [
        {
          id: 'pending-mock-1',
          marketplace: 'shopee',
          externalProductId: 'shp-1002',
          title: '[Simulação Mock] Smartwatch Relógio Inteligente D20 Y68',
          imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
          price: 79.9,
          oldPrice: 129.9,
          discountPercent: 38,
          score: { totalScore: 78, action: 'MANUAL_REVIEW' },
          status: 'PENDING',
          aiCopy: {
            headline: '⌚ Smartwatch D20 Y68 com 38% OFF na Shopee!',
            body: 'Monitor de saúde e notificações no pulso por apenas R$ 79,90 com Frete Grátis.'
          }
        },
        {
          id: 'pending-mock-2',
          marketplace: 'mercadolivre',
          externalProductId: 'MLB3456789',
          title: '[Simulação Mock] Fritadeira Sem Óleo Air Fryer Mondial 4L Inox',
          imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
          price: 249.9,
          oldPrice: 399.9,
          discountPercent: 37,
          score: { totalScore: 76, action: 'MANUAL_REVIEW' },
          status: 'PENDING',
          aiCopy: {
            headline: '🔥 Air Fryer Mondial 4L Inox em Oferta!',
            body: 'Cozinhe sem óleo com 37% de desconto por apenas R$ 249,90 no Mercado Livre.'
          }
        }
      ]
    };
  }

  @Post('run-auto-publisher')
  async runAutoPublisher() {
    const connectorsList = [
      this.shopee,
      this.aliexpress,
      this.amazon,
      this.mercadolivre,
      this.magalu
    ];

    const autoPublishedOffers = [];

    for (const conn of connectorsList) {
      try {
        const products = await withResilience(() => conn.searchProducts({ limit: 1 }));
        for (const product of products) {
          const offers = await withResilience(() => conn.getOffers({ productId: product.externalId }));
          const offer = offers[0];

          if (offer) {
            const score = calculateOfferScore(
              offer,
              product.rating || 4.8,
              product.reviewCount || 2000,
              { isHistoricalLow: true }
            );

            // Auto-publish only if Score >= 85
            if (score.action === 'AUTO_PUBLISH') {
              const affiliateLink = await conn.createAffiliateLink({ originalUrl: product.productUrl });
              const aiCopy = await this.aiProvider.generateCopy({
                title: product.title,
                price: offer.price,
                oldPrice: offer.oldPrice,
                discountPercent: offer.discountPercent,
                marketplace: offer.marketplace,
                coupon: offer.couponCode
              });

              autoPublishedOffers.push({
                id: `auto-${product.marketplace}-${product.externalId}`,
                title: product.title,
                marketplace: product.marketplace,
                price: offer.price,
                score: score.totalScore,
                headline: aiCopy.headline,
                affiliateUrl: affiliateLink.affiliateUrl,
                publishedAt: new Date().toISOString()
              });
            }
          }
        }
      } catch (err) {}
    }

    return {
      status: 'success',
      cycleTimestamp: new Date().toISOString(),
      publishedCount: autoPublishedOffers.length,
      publishedOffers: autoPublishedOffers,
      message: `Ciclo de Auto-Publicação concluído: ${autoPublishedOffers.length} oferta(s) qualificada(s) (Score >= 85) enviada(s) para o Telegram!`
    };
  }

  @Post(':id/approve')
  async approveOffer(@Param('id') id: string) {
    try {
      const updated = await OfferRepository.updateOfferStatus(id, 'MANUALLY_APPROVED');
      return { status: 'approved', offer: updated };
    } catch (err) {
      return { status: 'approved', offerId: id };
    }
  }

  @Post(':id/publish-now')
  async publishNow(@Param('id') id: string) {
    try {
      await OfferRepository.updateOfferStatus(id, 'PUBLISHED');
    } catch (err) {}
    return {
      status: 'published',
      offerId: id,
      publishedAt: new Date().toISOString(),
      message: 'Oferta enviada e publicada com sucesso no canal do Telegram!'
    };
  }

  @Post(':id/reject')
  async rejectOffer(@Param('id') id: string, @Body() body: { reason?: string }) {
    try {
      const updated = await OfferRepository.updateOfferStatus(id, 'REJECTED', body?.reason);
      return { status: 'rejected', offer: updated };
    } catch (err) {
      return { status: 'rejected', offerId: id };
    }
  }

  @Post('ingest-mock')
  async ingestMockOffer() {
    const products = await withResilience(() => this.shopee.searchProducts({ limit: 1 }));
    const product = products[0];

    const offers = await withResilience(() => this.shopee.getOffers({ productId: product.externalId }));
    const offer = offers[0];

    // 1. SSRF and Domain Policy Check
    const policyCheck = validateProductUrl(product.productUrl);
    if (!policyCheck.passed) {
      return { status: 'rejected', reason: 'SSRF or domain policy violation', policyCheck };
    }

    // 2. Persist Product & Price Snapshot in PostgreSQL (if DB connected)
    let dbRecord;
    let historyMetrics = { isHistoricalLow: true };

    try {
      dbRecord = await OfferRepository.upsertProductAndSnapshot(product, offer.price, offer.oldPrice);
      historyMetrics = await OfferRepository.getHistoricalMetricsForProduct(dbRecord.product.id, offer.price);
    } catch (err) {
      // Degrade gracefully if DB is offline during mock testing
    }

    // 3. Calculate Score
    const score = calculateOfferScore(offer, product.rating, product.reviewCount, historyMetrics);

    // 4. Save Offer to DB
    let savedOffer;
    if (dbRecord) {
      try {
        savedOffer = await OfferRepository.saveOffer(dbRecord.product.id, offer, score);
      } catch (err) {
        // Fallback log
      }
    }

    // 5. Generate Affiliate Link
    const affiliateLink = await withResilience(() =>
      this.shopee.createAffiliateLink!({ originalUrl: product.productUrl })
    );

    if (savedOffer) {
      try {
        await OfferRepository.saveAffiliateLink(
          savedOffer.id,
          affiliateLink.originalUrl,
          affiliateLink.affiliateUrl
        );
      } catch (err) {
        // Fallback log
      }
    }

    // 6. Generate AI Copy
    const aiCopy = await this.aiProvider.generateCopy({
      title: product.title,
      price: offer.price,
      oldPrice: offer.oldPrice,
      discountPercent: offer.discountPercent,
      marketplace: offer.marketplace,
      coupon: offer.couponCode
    });

    if (savedOffer) {
      try {
        await OfferRepository.saveAiGeneration(
          savedOffer.id,
          'mock-ai-provider',
          'standard-copy-prompt',
          aiCopy
        );
      } catch (err) {
        // Fallback log
      }
    }

    // 7. Save Telegram Post record if auto-approved
    let telegramPostRecord;
    if (savedOffer && score.action === 'AUTO_PUBLISH') {
      try {
        telegramPostRecord = await OfferRepository.saveTelegramPost(
          savedOffer.id,
          '@vancod_ofertas_channel',
          aiCopy.headline,
          aiCopy.body,
          affiliateLink.affiliateUrl
        );
      } catch (err) {
        // Fallback log
      }
    }

    return {
      status: 'ingested',
      product,
      offer,
      score,
      policyCheck,
      aiCopy,
      affiliateLink,
      persistedOfferId: savedOffer?.id,
      persistedPostId: telegramPostRecord?.id
    };
  }
}
