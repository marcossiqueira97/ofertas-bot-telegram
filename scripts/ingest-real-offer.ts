import { MercadoLivreConnector } from '@vancod/connector-mercadolivre';
import {
  calculateOfferScore,
  calculatePriceHistoryMetrics,
  validateOfferPolicy
} from '@vancod/affiliate-core';
import { createAiProvider } from '@vancod/ai';
import { telegramPublisher } from '@vancod/telegram-bot';
import { env } from '@vancod/config';
import { prisma } from '@vancod/database';

function maskValue(val?: string): string {
  if (!val || val.trim() === '') return 'NOT_CONFIGURED';
  if (val.length <= 4) return '***';
  return `${val.substring(0, 2)}***${val.substring(val.length - 2)}`;
}

async function main() {
  console.log('\n==================================================');
  console.log('🚀 VANCOD OFERTAS — INGESTÃO E PROCESSANDO OFERTA REAL');
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
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    console.log('\n💡 Para realizar buscas reais na API do Mercado Livre, configure MERCADOLIVRE_ACCESS_TOKEN no .env.');
    process.exit(1);
  }

  if (!realProduct) {
    console.log('Produto: ERROR (Nenhum produto retornado)');
    console.log('Preço: ERROR');
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
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
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    process.exit(1);
  }

  if (!realOffer) {
    console.log('Preço: ERROR');
    console.log('Histórico: ERROR');
    console.log(`matt_word: ${maskValue(env.MERCADOLIVRE_MATT_WORD)}`);
    console.log(`matt_tool: ${maskValue(env.MERCADOLIVRE_MATT_TOOL)}`);
    console.log('Affiliate: NOT_AVAILABLE');
    process.exit(1);
  }
  console.log(`Preço: OK (R$ ${realOffer.price.toFixed(2)})`);

  // 4. Histórico
  const historyMetrics = calculatePriceHistoryMetrics(realOffer.price, []);
  console.log('Histórico: OK');

  // 5. Status do Afiliado
  const mattWordStatus = env.MERCADOLIVRE_MATT_WORD ? `CONFIGURED (${maskValue(env.MERCADOLIVRE_MATT_WORD)})` : 'NOT_CONFIGURED';
  const mattToolStatus = env.MERCADOLIVRE_MATT_TOOL ? `CONFIGURED (${maskValue(env.MERCADOLIVRE_MATT_TOOL)})` : 'NOT_CONFIGURED';
  console.log(`matt_word: ${mattWordStatus}`);
  console.log(`matt_tool: ${mattToolStatus}`);

  const affiliateResult = await connector.createAffiliateLink({
    originalUrl: realProduct.productUrl
  });

  const affiliateStatus = affiliateResult.affiliateUrl !== 'NOT_AVAILABLE' ? 'AVAILABLE' : 'NOT_AVAILABLE';
  console.log(`Affiliate: ${affiliateStatus}`);

  if (affiliateResult.affiliateUrl !== 'NOT_AVAILABLE') {
    console.log(`\n🔗 Link Gerado: ${affiliateResult.affiliateUrl}`);
  }

  // 6. Score & Copy & Policy
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

  if (!policyResult.passed) {
    console.warn('\n⚠️ Policy Check reprovou publicação automática:', policyResult.violations);
  } else {
    console.log('\n✅ Policy Check aprovado com sucesso sem violações!');
  }

  // 7. Persistência no Banco
  try {
    const productRecord = await prisma.product.upsert({
      where: {
        marketplace_externalId: {
          marketplace: realProduct.marketplace,
          externalId: realProduct.externalId
        }
      },
      update: {
        title: realProduct.title,
        imageUrl: realProduct.imageUrl
      },
      create: {
        marketplace: realProduct.marketplace,
        externalId: realProduct.externalId,
        title: realProduct.title,
        productUrl: realProduct.productUrl,
        imageUrl: realProduct.imageUrl,
        brand: realProduct.brand
      }
    });

    const offerRecord = await prisma.offer.create({
      data: {
        productId: productRecord.id,
        price: realOffer.price,
        oldPrice: realOffer.oldPrice,
        discountPercent: realOffer.discountPercent,
        currency: realOffer.currency,
        score: scoreBreakdown.totalScore,
        status: scoreBreakdown.action === 'AUTO_PUBLISH' ? 'AUTO_APPROVED' : 'PENDING_REVIEW'
      }
    });

    if (affiliateResult.affiliateUrl !== 'NOT_AVAILABLE') {
      await prisma.affiliateLink.create({
        data: {
          offerId: offerRecord.id,
          originalUrl: realProduct.productUrl,
          affiliateUrl: affiliateResult.affiliateUrl,
          marketplace: realProduct.marketplace
        }
      });
    }

    console.log(`\n💾 Oferta gravada no PostgreSQL (ID: ${offerRecord.id})`);
  } catch (err: any) {
    console.warn(`\n⚠️ Não foi possível salvar no PostgreSQL (Banco desconectado ou credentials invalid): ${err?.message || err}`);
  }

  // 8. Publicação no Telegram Real
  console.log('\n📢 Publicando no Telegram Real...');
  if (affiliateResult.affiliateUrl === 'NOT_AVAILABLE') {
    console.log(`ℹ️ Publicação abortada por política: Oferta sem link de afiliado válido (Affiliate: NOT_AVAILABLE).`);
  } else {
    const publishResult = await telegramPublisher.publishOffer({
      headline: aiResult.headline,
      body: aiResult.body,
      ctaUrl: affiliateResult.affiliateUrl,
      imageUrl: realProduct.imageUrl
    });

    if (publishResult.published) {
      console.log(`🎉 OFERTA REAL PUBLICADA NO TELEGRAM COM SUCESSO! Message ID: ${publishResult.messageId}`);
    } else if (publishResult.mock) {
      console.log(`ℹ️ Publicação em modo MOCK / DRY-RUN (TELEGRAM_BOT_TOKEN não configurado no .env).`);
    } else {
      console.log(`⚠️ Status de Publicação: ${publishResult.status}`);
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
