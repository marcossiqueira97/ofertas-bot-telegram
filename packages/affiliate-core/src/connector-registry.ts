import {
  MarketplaceConnector,
  MarketplaceName,
  ConnectorHealth,
  SearchInput,
  NormalizedProduct
} from '@vancod/types';

export class ConnectorRegistry {
  private connectors = new Map<MarketplaceName, MarketplaceConnector>();

  public registerConnector(connector: MarketplaceConnector): void {
    this.connectors.set(connector.name, connector);
  }

  public getConnector(name: MarketplaceName): MarketplaceConnector | undefined {
    return this.connectors.get(name);
  }

  public getAllConnectors(): MarketplaceConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Runs health checks in parallel across all registered connectors.
   */
  async checkAllHealth(): Promise<ConnectorHealth[]> {
    const promises = this.getAllConnectors().map((c) => c.healthCheck());
    const results = await Promise.allSettled(promises);

    return results.map((res, index) => {
      if (res.status === 'fulfilled') {
        return res.value;
      }
      const connector = this.getAllConnectors()[index];
      return {
        status: 'error',
        marketplace: connector ? connector.name : 'mock',
        enabled: false,
        message: res.reason?.message || 'Health check failed'
      };
    });
  }

  /**
   * Searches products in parallel across all registered connectors.
   */
  async searchAll(input: SearchInput): Promise<NormalizedProduct[]> {
    const promises = this.getAllConnectors().map((c) => c.searchProducts(input));
    const results = await Promise.allSettled(promises);

    const allProducts: NormalizedProduct[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') {
        allProducts.push(...res.value);
      }
    }

    return allProducts;
  }
}
