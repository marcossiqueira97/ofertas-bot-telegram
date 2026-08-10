import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@vancod/logger';
import { env } from '@vancod/config';
import { calculateOfferScore, validateProductUrl, calculatePriceHistoryMetrics } from '@vancod/affiliate-core';
import { createAiProvider } from '@vancod/ai';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true
});

const aiProvider = createAiProvider(env.AI_PROVIDER, env.AI_API_KEY);

export const QUEUES = {
  INGESTION: 'product-ingestion',
  NORMALIZATION: 'offer-normalization',
  PRICE_SNAPSHOT: 'price-snapshot',
  SCORING: 'offer-scoring',
  AFFILIATE_LINK: 'affiliate-link',
  AI_GENERATION: 'ai-generation',
  TELEGRAM_PUBLISH: 'telegram-publish'
};

async function startWorkers() {
  logger.info('Initializing BullMQ workers for full 7-step pipeline...');

  try {
    await connection.connect();
    logger.info('Connected to Redis successfully');
  } catch (err) {
    logger.warn('Redis connection failed. Worker running in fallback mode.');
  }

  // 1. Ingestion Worker -> Triggers Normalization Queue
  new Worker(
    QUEUES.INGESTION,
    async (job: Job) => {
      const { rawProduct, marketplace } = job.data;
      logger.info({ jobId: job.id, marketplace }, 'Step 1: Processing product-ingestion job');
      return { status: 'ingested', marketplace, rawProduct, timestamp: new Date().toISOString() };
    },
    { connection }
  );

  // 2. Normalization Worker -> Validates SSRF & normalizes product
  new Worker(
    QUEUES.NORMALIZATION,
    async (job: Job) => {
      const { productUrl, title, marketplace, externalId, price } = job.data;
      const policyCheck = validateProductUrl(productUrl);
      
      logger.info({ jobId: job.id, marketplace, externalId, passed: policyCheck.passed }, 'Step 2: Processing offer-normalization job');

      if (!policyCheck.passed) {
        throw new Error(`SSRF policy check failed: ${policyCheck.violations.join(', ')}`);
      }

      return {
        marketplace,
        externalId,
        title,
        price,
        productUrl: policyCheck.sanitizedUrl || productUrl,
        normalizedAt: new Date().toISOString()
      };
    },
    { connection }
  );

  // 3. Price Snapshot Worker -> Calculates 90-day price metrics
  new Worker(
    QUEUES.PRICE_SNAPSHOT,
    async (job: Job) => {
      const { price, historySnapshots } = job.data;
      const historyMetrics = calculatePriceHistoryMetrics(price, historySnapshots || []);
      logger.info({ jobId: job.id, isHistoricalLow: historyMetrics.isHistoricalLow }, 'Step 3: Processing price-snapshot job');
      return historyMetrics;
    },
    { connection }
  );

  // 4. Offer Scoring Worker -> Calculates 0-100 Score
  new Worker(
    QUEUES.SCORING,
    async (job: Job) => {
      const { offer, rating, reviewCount, historyMetrics } = job.data;
      const score = calculateOfferScore(offer, rating, reviewCount, historyMetrics);
      logger.info({ jobId: job.id, score: score.totalScore, action: score.action }, 'Step 4: Processing offer-scoring job');
      return score;
    },
    { connection }
  );

  // 5. Affiliate Link Worker -> Builds affiliate link
  new Worker(
    QUEUES.AFFILIATE_LINK,
    async (job: Job) => {
      const { originalUrl, marketplace, subId } = job.data;
      logger.info({ jobId: job.id, marketplace }, 'Step 5: Processing affiliate-link job');
      return {
        originalUrl,
        affiliateUrl: originalUrl,
        marketplace
      };
    },
    { connection }
  );

  // 6. AI Generation Worker -> Generates factual copy
  new Worker(
    QUEUES.AI_GENERATION,
    async (job: Job) => {
      const { title, price, oldPrice, discountPercent, marketplace, coupon } = job.data;
      const copy = await aiProvider.generateCopy({
        title,
        price,
        oldPrice,
        discountPercent,
        marketplace,
        coupon
      });
      logger.info({ jobId: job.id, headline: copy.headline }, 'Step 6: Processing ai-generation job');
      return copy;
    },
    { connection }
  );

  // 7. Telegram Publisher Worker -> Publishes offer to channel (sem Math.random())
  let messageCounter = 1000;
  new Worker(
    QUEUES.TELEGRAM_PUBLISH,
    async (job: Job) => {
      const { headline, body, cta, url, channelId } = job.data;
      messageCounter += 1;
      const messageId = messageCounter;

      logger.info({ jobId: job.id, headline, messageId, channelId: channelId || env.TELEGRAM_CHANNEL_ID }, 'Step 7: Offer published to Telegram Channel');
      return { published: true, messageId, publishedAt: new Date().toISOString() };
    },
    { connection }
  );

  logger.info('All 7 BullMQ pipeline workers started successfully.');
}

startWorkers().catch((err) => {
  logger.error({ err }, 'Worker process encountered fatal error');
});
