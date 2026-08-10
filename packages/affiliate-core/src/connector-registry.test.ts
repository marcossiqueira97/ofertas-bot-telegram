import { describe, it, expect, vi } from 'vitest';
import { ConnectorRegistry } from './connector-registry';
import { MarketplaceConnector } from '@vancod/types';

describe('ConnectorRegistry', () => {
  const mockConnector: MarketplaceConnector = {
    name: 'shopee',
    healthCheck: vi.fn().mockResolvedValue({
      status: 'ok',
      marketplace: 'shopee',
      enabled: true
    }),
    searchProducts: vi.fn().mockResolvedValue([
      {
        marketplace: 'shopee',
        externalId: 'shp-1',
        title: 'Produto Teste',
        productUrl: 'https://shopee.com.br/p1'
      }
    ]),
    getProduct: vi.fn().mockResolvedValue(null),
    getOffers: vi.fn().mockResolvedValue([])
  };

  it('should register and retrieve connector by name', () => {
    const registry = new ConnectorRegistry();
    registry.registerConnector(mockConnector);

    expect(registry.getConnector('shopee')).toBe(mockConnector);
    expect(registry.getAllConnectors()).toHaveLength(1);
  });

  it('should run checkAllHealth across registered connectors', async () => {
    const registry = new ConnectorRegistry();
    registry.registerConnector(mockConnector);

    const healthList = await registry.checkAllHealth();
    expect(healthList).toHaveLength(1);
    expect(healthList[0].status).toBe('ok');
    expect(healthList[0].marketplace).toBe('shopee');
  });

  it('should searchAll products across registered connectors', async () => {
    const registry = new ConnectorRegistry();
    registry.registerConnector(mockConnector);

    const products = await registry.searchAll({ limit: 5 });
    expect(products).toHaveLength(1);
    expect(products[0].externalId).toBe('shp-1');
  });
});
