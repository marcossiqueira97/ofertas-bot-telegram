import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@vancod/logger';
import { env } from '@vancod/config';
import {
  calculateOfferScore,
  validateProductUrl,
  ConnectorRegistry
} from '@vancod/affiliate-core';
import { createAiProvider } from '@vancod/ai';
import { OfferRepository, prisma } from '@vancod/database';
import { telegramPublisher } from '@vancod/telegram-bot';
import { ShopeeConnector } from '@vancod/connector-shopee';
import { AliexpressConnector } from '@vancod/connector-aliexpress';
import { AmazonConnector } from '@vancod/connector-amazon';
import { MercadoLivreConnector } from '@vancod/connector-mercadolivre';
import { MagaluConnector } from '@vancod/connector-magalu';
import { NormalizedProduct, NormalizedOffer } from '@vancod/types';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true
});

const aiProvider = createAiProvider(env.AI_PROVIDER, env.AI_API_KEY);

const registry = new ConnectorRegistry();
registry.registerConnector(new ShopeeConnector(env.SHOPEE_ENABLED));
registry.registerConnector(new AliexpressConnector(env.ALIEXPRESS_ENABLED));
registry.registerConnector(new AmazonConnector(env.AMAZON_ENABLED));
registry.registerConnector(new MercadoLivreConnector(env.MERCADOLIVRE_ENABLED));
registry.registerConnector(new MagaluConnector(env.MAGALU_ENABLED));

export const QUEUES = {
  INGESTION: 'product-ingestion',
  NORMALIZATION: 'offer-normalization',
  PRICE_SNAPSHOT: 'price-snapshot',
  SCORING: 'offer-scoring',
  AFFILIATE_LINK: 'affiliate-link',
  AI_GENERATION: 'ai-generation',
  TELEGRAM_PUBLISH: 'telegram-publish'
};

// Queue producers for chaining
const queues = {
  normalization: new Queue(QUEUES.NORMALIZATION, { connection }),
  priceSnapshot: new Queue(QUEUES.PRICE_SNAPSHOT, { connection }),
  scoring: new Queue(QUEUES.SCORING, { connection }),
  affiliateLink: new Queue(QUEUES.AFFILIATE_LINK, { connection }),
  aiGeneration: new Queue(QUEUES.AI_GENERATION, { connection }),
  telegramPublish: new Queue(QUEUES.TELEGRAM_PUBLISH, { connection })
};

async function startWorkers() {
  logger.info('Initializing BullMQ workers for full 7-step chained pipeline...');

  try {
    await connection.connect();
    logger.info('Connected to Redis successfully');
  } catch (err) {
    logger.warn('Redis connection failed. Worker running in fallback mode.');
  }

  // 1. INGESTION WORKER -> Upserts Product & Triggers Normalization Queue
  new Worker(
    QUEUES.INGESTION,
    async (job: Job) => {
      const startTime = Date.now();
      const { product, price, oldPrice } = job.data as { product: NormalizedProduct; price: number; oldPrice?: number };

      try {
        const { product: dbProduct } = await OfferRepository.upsertProductAndSnapshot(product, price, oldPrice);

        await queues.normalization.add('normalize', {
          productId: dbProduct.id,
          product,
          price,
          oldPrice
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'INGESTION', marketplace: product.marketplace, productId: dbProduct.id, status: 'SUCCESS', durationMs },
          'Step 1: Product ingested and sent to normalization queue'
        );

        return { productId: dbProduct.id, status: 'INGESTED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'INGESTION', error: err.message }, 'Step 1 failed');
        throw err;
      }
    },
    { connection }
  );

  // 2. NORMALIZATION WORKER -> Validates SSRF & Triggers Price Snapshot Queue
  new Worker(
    QUEUES.NORMALIZATION,
    async (job: Job) => {
      const startTime = Date.now();
      const { productId, product, price, oldPrice } = job.data;

      try {
        const policyCheck = validateProductUrl(product.productUrl);
        if (!policyCheck.passed) {
          throw new Error(`SSRF policy check failed: ${policyCheck.violations.join(', ')}`);
        }

        await queues.priceSnapshot.add('snapshot', {
          productId,
          product,
          price,
          oldPrice
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'NORMALIZATION', productId, status: 'SUCCESS', durationMs },
          'Step 2: Offer normalized and sent to price snapshot queue'
        );

        return { productId, status: 'NORMALIZED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'NORMALIZATION', productId, error: err.message }, 'Step 2 failed');
        throw err;
      }
    },
    { connection }
  );

  // 3. PRICE SNAPSHOT WORKER -> Calculates 90d Price History Metrics & Triggers Scoring Queue
  new Worker(
    QUEUES.PRICE_SNAPSHOT,
    async (job: Job) => {
      const startTime = Date.now();
      const { productId, product, price, oldPrice } = job.data;

      try {
        const historyMetrics = await OfferRepository.getHistoricalMetricsForProduct(productId, price);

        await queues.scoring.add('score', {
          productId,
          product,
          price,
          oldPrice,
          historyMetrics
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'PRICE_SNAPSHOT', productId, isHistoricalLow: historyMetrics.isHistoricalLow, status: 'SUCCESS', durationMs },
          'Step 3: Price snapshot processed and sent to scoring queue'
        );

        return { productId, historyMetrics, status: 'SNAPSHOT_RECORDED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'PRICE_SNAPSHOT', productId, error: err.message }, 'Step 3 failed');
        throw err;
      }
    },
    { connection }
  );

  // 4. SCORING WORKER -> Calculates 0-100 Score, Persists Offer DB & Triggers Affiliate Link Queue
  new Worker(
    QUEUES.SCORING,
    async (job: Job) => {
      const startTime = Date.now();
      const { productId, product, price, oldPrice, historyMetrics } = job.data;

      try {
        const normalizedOffer: NormalizedOffer = {
          marketplace: product.marketplace,
          externalProductId: product.externalId,
          price,
          oldPrice,
          discountPercent: oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : undefined,
          currency: 'BRL',
          capturedAt: new Date().toISOString()
        };

        const score = calculateOfferScore(normalizedOffer, product.rating, product.reviewCount, historyMetrics);
        const dbOffer = await OfferRepository.saveOffer(productId, normalizedOffer, score);

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'SCORING', offerId: dbOffer.id, score: score.totalScore, action: score.action, status: 'SUCCESS', durationMs },
          'Step 4: Offer scored and persisted in database'
        );

        if (score.action === 'AUTO_PUBLISH') {
          await queues.affiliateLink.add('affiliate', {
            offerId: dbOffer.id,
            productId,
            product,
            offer: normalizedOffer,
            score
          });
        }

        return { offerId: dbOffer.id, score: score.totalScore, action: score.action, status: 'SCORED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'SCORING', productId, error: err.message }, 'Step 4 failed');
        throw err;
      }
    },
    { connection }
  );

  // 5. AFFILIATE LINK WORKER -> Checks Connector Capabilities & Triggers AI Generation Queue
  new Worker(
    QUEUES.AFFILIATE_LINK,
    async (job: Job) => {
      const startTime = Date.now();
      const { offerId, product, offer } = job.data;

      try {
        const connector = registry.getConnector(product.marketplace);
        let affiliateUrl = product.productUrl;
        let isRealAffiliate = false;

        if (connector && connector.capabilities?.affiliateLink && connector.createAffiliateLink) {
          const res = await connector.createAffiliateLink({ originalUrl: product.productUrl });
          affiliateUrl = res.affiliateUrl;
          isRealAffiliate = true;
        }

        const dbAffiliateLink = await OfferRepository.saveAffiliateLink(offerId, product.productUrl, affiliateUrl);

        await queues.aiGeneration.add('ai_copy', {
          offerId,
          product,
          offer,
          affiliateUrl,
          isRealAffiliate
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'AFFILIATE_LINK', offerId, affiliateUrl, isRealAffiliate, status: 'SUCCESS', durationMs },
          'Step 5: Affiliate link created and sent to AI copy queue'
        );

        return { affiliateLinkId: dbAffiliateLink.id, affiliateUrl, status: 'AFFILIATE_LINK_CREATED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'AFFILIATE_LINK', offerId, error: err.message }, 'Step 5 failed');
        throw err;
      }
    },
    { connection }
  );

  // 6. AI GENERATION WORKER -> Generates Factual Copy & Triggers Telegram Publish Queue
  new Worker(
    QUEUES.AI_GENERATION,
    async (job: Job) => {
      const startTime = Date.now();
      const { offerId, product, offer, affiliateUrl } = job.data;

      try {
        const copy = await aiProvider.generateCopy({
          title: product.title,
          price: offer.price,
          oldPrice: offer.oldPrice,
          discountPercent: offer.discountPercent,
          rating: product.rating,
          reviewCount: product.reviewCount,
          shipping: offer.freeShipping ? 'Grátis' : undefined,
          coupon: offer.couponCode,
          marketplace: product.marketplace
        });

        await OfferRepository.saveAiGeneration(offerId, aiProvider.name, 'Generate factual offer copy', copy);

        await queues.telegramPublish.add('publish', {
          offerId,
          headline: copy.headline,
          body: copy.body,
          ctaUrl: affiliateUrl,
          imageUrl: product.imageUrl
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'AI_GENERATION', offerId, headline: copy.headline, status: 'SUCCESS', durationMs },
          'Step 6: AI factual copy generated and sent to Telegram publish queue'
        );

        return { offerId, headline: copy.headline, status: 'AI_COPY_GENERATED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'AI_GENERATION', offerId, error: err.message }, 'Step 6 failed');
        throw err;
      }
    },
    { connection }
  );

  // 7. TELEGRAM PUBLISHER WORKER -> Publishes via TelegramPublisherService & Persists TelegramPost
  new Worker(
    QUEUES.TELEGRAM_PUBLISH,
    async (job: Job) => {
      const startTime = Date.now();
      const { offerId, headline, body, ctaUrl, imageUrl, channelId } = job.data;

      try {
        // Idempotency check: prevent duplicate Telegram posts for same offer
        const existingPost = await prisma.telegramPost.findFirst({
          where: { offerId }
        });

        if (existingPost) {
          logger.info({ jobId: job.id, stage: 'TELEGRAM_PUBLISH', offerId, existingPostId: existingPost.id }, 'Offer already published to Telegram. Skipping duplicate.');
          return { offerId, published: true, messageId: existingPost.messageId, duplicate: true };
        }

        const pubResult = await telegramPublisher.publishOffer({
          headline,
          body,
          ctaUrl,
          imageUrl,
          channelId
        });

        const dbPost = await OfferRepository.saveTelegramPost(
          offerId,
          channelId || env.TELEGRAM_CHANNEL_ID || '@vancod_ofertas_channel',
          headline,
          body,
          ctaUrl,
          pubResult.messageId
        );

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'TELEGRAM_PUBLISH', offerId, messageId: pubResult.messageId, mock: pubResult.mock, status: 'SUCCESS', durationMs },
          'Step 7: Offer published to Telegram channel and recorded in DB'
        );

        return { postId: dbPost.id, messageId: pubResult.messageId, mock: pubResult.mock, status: 'PUBLISHED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'TELEGRAM_PUBLISH', offerId, error: err.message }, 'Step 7 failed');
        throw err;
      }
    },
    { connection }
  );

  logger.info('All 7 BullMQ pipeline workers started and chained successfully.');
}

startWorkers().catch((err) => {
  logger.error({ err }, 'Worker process encountered fatal error');
});
