import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { logger } from '@vancod/logger';
import { env } from '@vancod/config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  app.enableCors();

  const port = env.API_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.info(`Vancod Ofertas API running on port ${port}`);
}
bootstrap();
