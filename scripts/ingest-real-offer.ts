import { MercadoLivreConnector } from '@vancod/connector-mercadolivre';
import {
  calculateOfferScore,
  calculatePriceHistoryMetrics,
  validateOfferPolicy
} from '@vancod/affiliate-core';
import { createAiProvider } from '@vancod/ai';
import { telegramPublisher } from '@vancod/telegram-bot';
import { env } from '@vancod/config';
import { prisma, OfferStatus } from '@vancod/database';

function maskValue(val?: string): string {
  if (!val || val.trim() === '') return 'NOT_CONFIGURED';
  if (val.length <= 4) return 'CONFIGURED (***)';
  return `CONFIGURED (${val.substring(0, 2)}***${val.substring(val.length - 2)})`;
}

async function main() {
  console.log('\n==================================================');
  console.log('🚀 VANCOD OFERTAS — INGESTÃO E PROCESSAMENTO FACTUAL');
  console.log('==================================================\n');

  console.log('Mercado Livre');
  const connector = new MercadoLivreConnector(true);

  // 1. Health check
  let healthOk = false;
  try {
    const health = await connector.healthCheck();
    healthOk = health.status === 'ok';
  } catch {
    healthOk = false;
  }
  console.log(`API: ${healthOk ? 'OK' : 'ERROR'}`);

  // 2. Busca de Produto Real
  let realProduct = null;
  try {
    const searchResults = await connector.searchProducts({ query: 'smartphone', limit: 1 });
    if (searchResults && searchResults.length > 0) {
      realProduct = searchResults[0];
    }
  } catch (err: any) {
    console.log(`Produto: ERROR (${err?.message || err})`);
    console.log('Preço: ERROR');
    console.log('Banco: ERROR');
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    console.log('Policy: REJECTED');
    console.log('Persistência: ERROR');
    console.log('Telegram: NOT_PUBLISHED');
    console.log('\n💡 Para realizar buscas reais na API do Mercado Livre, configure MERCADOLIVRE_ACCESS_TOKEN no .env.');
    process.exit(1);
  }

  if (!realProduct) {
    console.log('Produto: ERROR (Nenhum produto retornado)');
    console.log('Preço: ERROR');
    console.log('Banco: ERROR');
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    console.log('Policy: REJECTED');
    console.log('Persistência: ERROR');
    console.log('Telegram: NOT_PUBLISHED');
    process.exit(1);
  }
  console.log(`Produto: OK (${realProduct.title})`);

  // 3. Busca de Oferta Real
  let realOffer = null;
  try {
    const offers = await connector.getOffers({ productId: realProduct.externalId });
    if (offers && offers.length > 0) {
      realOffer = offers[0];
    }
  } catch (err: any) {
    console.log(`Preço: ERROR (${err?.message || err})`);
    console.log('Banco: ERROR');
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    console.log('Policy: REJECTED');
    console.log('Persistência: ERROR');
    console.log('Telegram: NOT_PUBLISHED');
    process.exit(1);
  }

  if (!realOffer) {
    console.log('Preço: ERROR');
    console.log('Banco: ERROR');
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    console.log('Policy: REJECTED');
    console.log('Persistência: ERROR');
    console.log('Telegram: NOT_PUBLISHED');
    process.exit(1);
  }
  console.log(`Preço: OK (R$ ${realOffer.price.toFixed(2)})`);

  // 4. Conexão ao Banco de Dados e Consulta de Snapshots de Preço Anteriores
  let marketplaceRecord: any = null;
  let previousSnapshots: { price: number; capturedAt: Date }[] = [];

  try {
    marketplaceRecord = await prisma.marketplace.upsert({
      where: { slug: 'mercadolivre' },
      update: { enabled: true },
      create: {
        name: 'Mercado Livre',
        slug: 'mercadolivre',
        enabled: true
      }
    });

    const existingProduct = await prisma.product.findUnique({
      where: {
        marketplaceId_externalId: {
          marketplaceId: marketplaceRecord.id,
          externalId: realProduct.externalId
        }
      },
      include: {
        prices: {
          select: { price: true, capturedAt: true },
          orderBy: { capturedAt: 'asc' }
        }
      }
    });

    if (existingProduct && existingProduct.prices) {
      previousSnapshots = existingProduct.prices.map((p) => ({
        price: Number(p.price),
        capturedAt: p.capturedAt
      }));
    }
    console.log('Banco: OK');
  } catch (err: any) {
    console.log(`Banco: ERROR (${err?.message || 'Conexão falhou'})`);
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    console.log('Policy: REJECTED');
    console.log('Persistência: ERROR');
    console.log('Telegram: NOT_PUBLISHED');
    process.exit(1);
  }

  // 5. Cálculo do Histórico Factual
  const historyMetrics = calculatePriceHistoryMetrics(realOffer.price, previousSnapshots);
  console.log('Histórico: OK');
  console.log(`Snapshots anteriores: ${previousSnapshots.length}`);
  console.log(`Menor preço histórico: ${historyMetrics.lowestPrice90d ? `R$ ${historyMetrics.lowestPrice90d.toFixed(2)}` : 'N/A'}`);
  console.log(`Preço atual: R$ ${realOffer.price.toFixed(2)}`);
  console.log(`Menor preço histórico: ${historyMetrics.isHistoricalLow ? 'SIM' : 'NÃO'}`);

  // 6. Configuração e Geração de Afiliado
  console.log(`\nmatt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
  console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);

  const affiliateResult = await connector.createAffiliateLink({
    originalUrl: realProduct.productUrl
  });

  const affiliateStatus = affiliateResult.affiliateUrl !== 'NOT_AVAILABLE' ? 'AFFILIATE_LINK_AVAILABLE' : 'NOT_AVAILABLE';
  console.log(`Affiliate: ${affiliateStatus}`);

  if (affiliateResult.affiliateUrl !== 'NOT_AVAILABLE') {
    console.log(`🔗 Link Gerado: ${affiliateResult.affiliateUrl}`);
  }

  // 7. Score, Copy IA e Policy Check
  const scoreBreakdown = calculateOfferScore(
    realOffer,
    realProduct.rating,
    realProduct.reviewCount,
    historyMetrics
  );

  const aiProvider = createAiProvider();
  const aiResult = await aiProvider.generateCopy({
    title: realProduct.title,
    price: realOffer.price,
    oldPrice: realOffer.oldPrice,
    discountPercent: realOffer.discountPercent,
    marketplace: 'Mercado Livre',
    shipping: realOffer.freeShipping ? 'Frete Grátis' : undefined,
    rating: realProduct.rating
  });

  const policyResult = validateOfferPolicy({
    price: realOffer.price,
    marketplace: realProduct.marketplace,
    affiliateUrl: affiliateResult.affiliateUrl,
    isAffiliateAvailable: connector.capabilities.affiliateLink,
    discountPercent: realOffer.discountPercent,
    oldPrice: realOffer.oldPrice,
    freeShipping: realOffer.freeShipping,
    headline: aiResult.headline,
    body: aiResult.body
  });

  console.log(`Policy: ${policyResult.passed ? 'APPROVED' : 'REJECTED'}`);
  if (!policyResult.passed) {
    console.warn('⚠️ Policy Check reprovou publicação automática:', policyResult.violations);
  }

  // 8. Persistência Obrigatória no PostgreSQL (Antes do Telegram)
  let persistedOfferRecord: any = null;
  try {
    const productRecord = await prisma.product.upsert({
      where: {
        marketplaceId_externalId: {
          marketplaceId: marketplaceRecord.id,
          externalId: realProduct.externalId
        }
      },
      update: {
        title: realProduct.title,
        brand: realProduct.brand,
        description: realProduct.description,
        imageUrl: realProduct.imageUrl,
        productUrl: realProduct.productUrl,
        rating: realProduct.rating,
        reviewCount: realProduct.reviewCount
      },
      create: {
        marketplaceId: marketplaceRecord.id,
        externalId: realProduct.externalId,
        title: realProduct.title,
        brand: realProduct.brand,
        description: realProduct.description,
        imageUrl: realProduct.imageUrl,
        productUrl: realProduct.productUrl,
        rating: realProduct.rating,
        reviewCount: realProduct.reviewCount
      }
    });

    await prisma.productPrice.create({
      data: {
        productId: productRecord.id,
        price: realOffer.price,
        oldPrice: realOffer.oldPrice,
        currency: realOffer.currency || 'BRL'
      }
    });

    const offerStatus: OfferStatus = scoreBreakdown.action === 'AUTO_PUBLISH' ? 'AUTO_APPROVED' : 'PENDING';

    persistedOfferRecord = await prisma.offer.create({
      data: {
        productId: productRecord.id,
        price: realOffer.price,
        oldPrice: realOffer.oldPrice,
        discountPercent: realOffer.discountPercent,
        currency: realOffer.currency || 'BRL',
        availability: realOffer.availability || 'IN_STOCK',
        seller: realOffer.seller,
        freeShipping: realOffer.freeShipping || false,
        score: scoreBreakdown.totalScore,
        status: offerStatus
      }
    });

    if (affiliateResult.affiliateUrl !== 'NOT_AVAILABLE') {
      await prisma.affiliateLink.create({
        data: {
          offerId: persistedOfferRecord.id,
          originalUrl: realProduct.productUrl,
          affiliateUrl: affiliateResult.affiliateUrl
        }
      });
    }

    await prisma.aiGeneration.create({
      data: {
        offerId: persistedOfferRecord.id,
        provider: 'mock',
        promptUsed: 'ingest-real-offer',
        headline: aiResult.headline,
        body: aiResult.body,
        cta: aiResult.cta,
        riskFlags: aiResult.riskFlags || []
      }
    });

    console.log('Persistência: OK');
  } catch (err: any) {
    console.log(`Persistência: ERROR (${err?.message || err})`);
    console.log('Telegram: NOT_PUBLISHED');
    process.exit(1);
  }

  // 9. Publicação no Telegram Real (Somente se Persistência OK + Policy APPROVED + Link Válido)
  if (affiliateResult.affiliateUrl === 'NOT_AVAILABLE' || !policyResult.passed) {
    console.log('Telegram: NOT_PUBLISHED');
  } else {
    try {
      const publishResult = await telegramPublisher.publishOffer({
        headline: aiResult.headline,
        body: aiResult.body,
        ctaUrl: affiliateResult.affiliateUrl,
        imageUrl: realProduct.imageUrl
      });

      if (publishResult.published) {
        console.log('Telegram: PUBLISHED');
      } else if (publishResult.mock) {
        console.log('Telegram: MOCK');
      } else {
        console.log('Telegram: NOT_PUBLISHED');
      }
    } catch {
      console.log('Telegram: NOT_PUBLISHED');
    }
  }

  console.log('\n==================================================');
  console.log('✨ PROCESSAMENTO CONCLUÍDO COM SUCESSO!');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('💥 Erro fatal:', err?.message || err);
  process.exit(1);
});
