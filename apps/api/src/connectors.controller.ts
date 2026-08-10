import { Controller, Get, Query } from '@nestjs/common';
import { ConnectorRegistry } from '@vancod/affiliate-core';
import { ShopeeConnector } from '@vancod/connector-shopee';
import { AliexpressConnector } from '@vancod/connector-aliexpress';
import { AmazonConnector } from '@vancod/connector-amazon';
import { MercadoLivreConnector } from '@vancod/connector-mercadolivre';
import { MagaluConnector } from '@vancod/connector-magalu';
import { env } from '@vancod/config';

@Controller('connectors')
export class ConnectorsController {
  private registry = new ConnectorRegistry();

  constructor() {
    this.registry.registerConnector(new ShopeeConnector(env.SHOPEE_ENABLED));
    this.registry.registerConnector(new AliexpressConnector(env.ALIEXPRESS_ENABLED));
    this.registry.registerConnector(new AmazonConnector(env.AMAZON_ENABLED));
    this.registry.registerConnector(new MercadoLivreConnector(env.MERCADOLIVRE_ENABLED));
    this.registry.registerConnector(new MagaluConnector(env.MAGALU_ENABLED));
  }

  @Get()
  async getStatus() {
    const healthChecks = await this.registry.checkAllHealth();
    return {
      connectors: healthChecks
    };
  }

  @Get('search')
  async searchAll(@Query('query') query: string) {
    const products = await this.registry.searchAll({ query, limit: 10 });
    return {
      count: products.length,
      products
    };
  }
}
