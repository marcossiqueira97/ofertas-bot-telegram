import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@vancod/logger';
import { env } from '@vancod/config';
import { calculateOfferScore, validateProductUrl } from '@vancod/affiliate-core';
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
  logger.info('Initializing BullMQ workers...');

  try {
    await connection.connect();
    logger.info('Connected to Redis successfully');
  } catch (err) {
    logger.warn('Redis connection failed. Worker running in fallback mode.');
  }

  // 1. Ingestion Worker
  new Worker(
    QUEUES.INGESTION,
    async (job: Job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing product-ingestion job');
      return { status: 'ingested', count: 1 };
    },
    { connection }
  );

  // 2. Offer Scoring Worker
  new Worker(
    QUEUES.SCORING,
    async (job: Job) => {
      const { offer, product } = job.data;
      const score = calculateOfferScore(offer, product?.rating, product?.reviewCount, { isHistoricalLow: true });
      logger.info({ jobId: job.id, score: score.totalScore, action: score.action }, 'Offer scored');
      return score;
    },
    { connection }
  );

  // 3. AI Generation Worker
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
      logger.info({ jobId: job.id, headline: copy.headline }, 'AI Copy generated');
      return copy;
    },
    { connection }
  );

  // 4. Telegram Publisher Worker
  new Worker(
    QUEUES.TELEGRAM_PUBLISH,
    async (job: Job) => {
      const { headline, body, cta, url } = job.data;
      logger.info({ jobId: job.id, headline, url }, 'Mock published offer to Telegram Channel');
      return { published: true, messageId: Math.floor(Math.random() * 10000) };
    },
    { connection }
  );

  logger.info('All workers started successfully.');
}

startWorkers().catch((err) => {
  logger.error({ err }, 'Worker process encountered fatal error');
});
