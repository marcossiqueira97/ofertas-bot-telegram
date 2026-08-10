import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@vancod/logger';
import { env } from '@vancod/config';
import {
  calculateOfferScore,
  validateProductUrl,
  validateOfferPolicy,
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
  POLICY_CHECK: 'policy-check',
  TELEGRAM_PUBLISH: 'telegram-publish'
};

// Queue producers for 8-step chained pipeline
const queues = {
  normalization: new Queue(QUEUES.NORMALIZATION, { connection }),
  priceSnapshot: new Queue(QUEUES.PRICE_SNAPSHOT, { connection }),
  scoring: new Queue(QUEUES.SCORING, { connection }),
  affiliateLink: new Queue(QUEUES.AFFILIATE_LINK, { connection }),
  aiGeneration: new Queue(QUEUES.AI_GENERATION, { connection }),
  policyCheck: new Queue(QUEUES.POLICY_CHECK, { connection }),
  telegramPublish: new Queue(QUEUES.TELEGRAM_PUBLISH, { connection })
};

async function startWorkers() {
  logger.info('Initializing BullMQ workers for full 8-step chained pipeline with deterministic policy checks...');

  try {
    await connection.connect();
    logger.info('Connected to Redis successfully');
  } catch (err) {
    logger.warn('Redis connection failed. Worker running in fallback mode.');
  }

  // 1. INGESTION WORKER -> Upserts Product ONLY. Does NOT create Price Snapshot here.
  new Worker(
    QUEUES.INGESTION,
    async (job: Job) => {
      const startTime = Date.now();
      const { product, price, oldPrice, sourceEventId } = job.data as { product: NormalizedProduct; price: number; oldPrice?: number; sourceEventId?: string };
      const eventId = sourceEventId || job.data.eventId || job.id;

      try {
        const { product: dbProduct } = await OfferRepository.upsertProductOnly(product);

        await queues.normalization.add('normalize', {
          productId: dbProduct.id,
          product,
          price,
          oldPrice,
          sourceEventId: eventId
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'INGESTION', marketplace: product.marketplace, productId: dbProduct.id, status: 'SUCCESS', durationMs },
          'Step 1: Product ingested into DB (without snapshot) and sent to normalization queue'
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
      const { productId, product, price, oldPrice, sourceEventId } = job.data;

      try {
        const policyCheck = validateProductUrl(product.productUrl);
        if (!policyCheck.passed) {
          throw new Error(`SSRF policy check failed: ${policyCheck.violations.join(', ')}`);
        }

        await queues.priceSnapshot.add('snapshot', {
          productId,
          product,
          price,
          oldPrice,
          sourceEventId
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

  // 3. PRICE SNAPSHOT WORKER -> Creates ProductPrice in DB & Calculates 90d Price History Metrics
  new Worker(
    QUEUES.PRICE_SNAPSHOT,
    async (job: Job) => {
      const startTime = Date.now();
      const { productId, product, price, oldPrice, sourceEventId } = job.data;

      try {
        const historyMetrics = await OfferRepository.getHistoricalMetricsForProduct(productId, price);
        await OfferRepository.createPriceSnapshot(productId, price, oldPrice, sourceEventId);

        await queues.scoring.add('score', {
          productId,
          product,
          price,
          oldPrice,
          historyMetrics,
          sourceEventId
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'PRICE_SNAPSHOT', productId, isHistoricalLow: historyMetrics.isHistoricalLow, status: 'SUCCESS', durationMs },
          'Step 3: Price snapshot recorded in DB and sent to scoring queue'
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
      const { productId, product, price, oldPrice, historyMetrics, sourceEventId } = job.data;

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
        const dbOffer = await OfferRepository.saveOffer(productId, normalizedOffer, score, sourceEventId);

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'SCORING', offerId: dbOffer.id, score: score.totalScore, action: score.action, status: 'SUCCESS', durationMs },
          'Step 4: Offer scored and persisted in database (Idempotent)'
        );

        if (score.action === 'AUTO_PUBLISH') {
          await queues.affiliateLink.add('affiliate', {
            offerId: dbOffer.id,
            productId,
            product,
            offer: normalizedOffer,
            score,
            historyMetrics
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

  // 5. AFFILIATE LINK WORKER -> Checks Connector Capabilities (Does NOT forge fake links)
  new Worker(
    QUEUES.AFFILIATE_LINK,
    async (job: Job) => {
      const startTime = Date.now();
      const { offerId, product, offer, score, historyMetrics } = job.data;

      try {
        const connector = registry.getConnector(product.marketplace);
        let affiliateUrl = 'NOT_AVAILABLE';
        let isAffiliateAvailable = false;

        if (connector && connector.capabilities?.affiliateLink && connector.createAffiliateLink) {
          const res = await connector.createAffiliateLink({ originalUrl: product.productUrl });
          if (res.affiliateUrl && res.affiliateUrl !== product.productUrl) {
            affiliateUrl = res.affiliateUrl;
            isAffiliateAvailable = true;
          }
        }

        if (isAffiliateAvailable) {
          await OfferRepository.saveAffiliateLink(offerId, product.productUrl, affiliateUrl);
        }

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'AFFILIATE_LINK', offerId, affiliateUrl, isAffiliateAvailable, status: 'SUCCESS', durationMs },
          'Step 5: Affiliate link capability evaluated'
        );

        if (!isAffiliateAvailable) {
          logger.warn(
            { jobId: job.id, stage: 'AFFILIATE_LINK', offerId, marketplace: product.marketplace },
            'Connector has no real affiliateLink capability or credentials configured. Halting publication for this offer.'
          );
          return { offerId, status: 'NOT_AVAILABLE', isAffiliateAvailable: false };
        }

        await queues.aiGeneration.add('ai_copy', {
          offerId,
          product,
          offer,
          score,
          historyMetrics,
          affiliateUrl,
          isAffiliateAvailable
        });

        return { offerId, affiliateUrl, isAffiliateAvailable: true, status: 'AFFILIATE_LINK_CREATED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'AFFILIATE_LINK', offerId, error: err.message }, 'Step 5 failed');
        throw err;
      }
    },
    { connection }
  );

  // 6. AI GENERATION WORKER -> Generates Factual Copy & Triggers Policy Check Queue
  new Worker(
    QUEUES.AI_GENERATION,
    async (job: Job) => {
      const startTime = Date.now();
      const { offerId, product, offer, score, historyMetrics, affiliateUrl, isAffiliateAvailable } = job.data;

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

        await queues.policyCheck.add('policy_check', {
          offerId,
          product,
          offer,
          copy,
          affiliateUrl,
          isAffiliateAvailable,
          historyMetrics
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'AI_GENERATION', offerId, headline: copy.headline, status: 'SUCCESS', durationMs },
          'Step 6: AI factual copy generated and sent to policy check queue'
        );

        return { offerId, headline: copy.headline, status: 'AI_COPY_GENERATED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'AI_GENERATION', offerId, error: err.message }, 'Step 6 failed');
        throw err;
      }
    },
    { connection }
  );

  // 7. POLICY CHECK WORKER -> Deterministic validation before publication
  new Worker(
    QUEUES.POLICY_CHECK,
    async (job: Job) => {
      const startTime = Date.now();
      const { offerId, product, offer, copy, affiliateUrl, isAffiliateAvailable, historyMetrics } = job.data;

      try {
        const policyCheck = validateOfferPolicy({
          price: offer.price,
          marketplace: product.marketplace,
          affiliateUrl,
          isAffiliateAvailable,
          discountPercent: offer.discountPercent,
          oldPrice: offer.oldPrice,
          couponCode: offer.couponCode,
          freeShipping: offer.freeShipping,
          isHistoricalLow: historyMetrics?.isHistoricalLow,
          headline: copy.headline,
          body: copy.body
        });

        const durationMs = Date.now() - startTime;

        if (!policyCheck.passed) {
          logger.warn(
            { jobId: job.id, stage: 'POLICY_CHECK', offerId, violations: policyCheck.violations, status: 'BLOCKED', durationMs },
            'Step 7: Policy check BLOCKED offer publication due to factual or affiliate link violations'
          );
          return { offerId, passed: false, violations: policyCheck.violations, status: 'BLOCKED' };
        }

        await queues.telegramPublish.add('publish', {
          offerId,
          headline: copy.headline,
          body: copy.body,
          ctaUrl: affiliateUrl,
          imageUrl: product.imageUrl
        });

        logger.info(
          { jobId: job.id, stage: 'POLICY_CHECK', offerId, status: 'SUCCESS', durationMs },
          'Step 7: Deterministic policy check passed cleanly'
        );

        return { offerId, passed: true, status: 'POLICY_PASSED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'POLICY_CHECK', offerId, error: err.message }, 'Step 7 failed');
        throw err;
      }
    },
    { connection }
  );

  // 8. TELEGRAM PUBLISHER WORKER -> Publishes via TelegramPublisherService & Records Status
  new Worker(
    QUEUES.TELEGRAM_PUBLISH,
    async (job: Job) => {
      const startTime = Date.now();
      const { offerId, headline, body, ctaUrl, imageUrl, channelId } = job.data;

      try {
        // Idempotency check: prevent duplicate Telegram posts ONLY if already PUBLISHED
        const existingPost = await prisma.telegramPost.findFirst({
          where: { offerId, status: 'PUBLISHED' }
        });

        if (existingPost) {
          logger.info({ jobId: job.id, stage: 'TELEGRAM_PUBLISH', offerId, existingPostId: existingPost.id }, 'Offer already published to Telegram with status PUBLISHED. Skipping duplicate.');
          return { offerId, published: true, messageId: existingPost.messageId, duplicate: true };
        }

        const pubResult = await telegramPublisher.publishOffer({
          headline,
          body,
          ctaUrl,
          imageUrl,
          channelId
        });

        const targetChannel = channelId || env.TELEGRAM_CHANNEL_ID || '@vancod_ofertas_channel';

        if (!pubResult.published || pubResult.mock || pubResult.status === 'NOT_CONFIGURED') {
          await OfferRepository.saveTelegramPost(
            offerId,
            targetChannel,
            headline,
            body,
            ctaUrl,
            0,
            'NOT_CONFIGURED'
          );

          const durationMs = Date.now() - startTime;
          logger.warn(
            { jobId: job.id, stage: 'TELEGRAM_PUBLISH', offerId, status: 'NOT_CONFIGURED', durationMs },
            'Step 8: Telegram Bot token/channel not configured. Post recorded as NOT_CONFIGURED in DB.'
          );
          return { offerId, published: false, status: 'NOT_CONFIGURED' };
        }

        const dbPost = await OfferRepository.saveTelegramPost(
          offerId,
          targetChannel,
          headline,
          body,
          ctaUrl,
          pubResult.messageId,
          'PUBLISHED'
        );

        const durationMs = Date.now() - startTime;
        logger.info(
          { jobId: job.id, stage: 'TELEGRAM_PUBLISH', offerId, messageId: pubResult.messageId, status: 'SUCCESS', durationMs },
          'Step 8: Offer published to Telegram channel with real message_id and recorded in DB'
        );

        return { postId: dbPost.id, messageId: pubResult.messageId, status: 'PUBLISHED' };
      } catch (err: any) {
        logger.error({ jobId: job.id, stage: 'TELEGRAM_PUBLISH', offerId, error: err.message }, 'Step 8 failed');
        throw err;
      }
    },
    { connection }
  );

  logger.info('All 8 BullMQ pipeline workers started and chained successfully.');
}

startWorkers().catch((err) => {
  logger.error({ err }, 'Worker process encountered fatal error');
});
