import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/vancod_ofertas?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(3000),
  WEB_PORT: z.coerce.number().default(3001),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_CHANNEL_ID: z.string().optional().default(''),
  TELEGRAM_CHANNEL_USERNAME: z.string().optional().default(''),

  // Marketplace Feature Flags & API Keys
  SHOPEE_ENABLED: z.coerce.boolean().default(false),
  SHOPEE_APP_ID: z.string().optional().default(''),
  SHOPEE_APP_SECRET: z.string().optional().default(''),
  SHOPEE_AFFILIATE_ID: z.string().optional().default('vancod_shopee_aff'),

  ALIEXPRESS_ENABLED: z.coerce.boolean().default(false),
  ALIEXPRESS_APP_KEY: z.string().optional().default(''),
  ALIEXPRESS_APP_SECRET: z.string().optional().default(''),
  ALIEXPRESS_TRACKING_ID: z.string().optional().default('vancod_ali_aff'),

  AMAZON_ENABLED: z.coerce.boolean().default(false),
  AMAZON_ASSOCIATE_TAG: z.string().optional().default('vancod-20'),

  MERCADOLIVRE_ENABLED: z.coerce.boolean().default(false),
  MERCADOLIVRE_ACCESS_TOKEN: z.string().optional().default(''),
  MERCADOLIVRE_AFFILIATE_TAG: z.string().optional().default('vancod_ml_aff'),

  MAGALU_ENABLED: z.coerce.boolean().default(false),
  MAGALU_STORE_NAME: z.string().optional().default('magazinevancod'),

  AI_PROVIDER: z.enum(['mock', 'openai', 'anthropic']).default('mock'),
  AI_API_KEY: z.string().optional().default(''),
  LOG_LEVEL: z.string().default('info')
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
