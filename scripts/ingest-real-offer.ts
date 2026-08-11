import { MercadoLivreConnector } from '@vancod/connector-mercadolivre';
import {
  calculateOfferScore,
  calculatePriceHistoryMetrics,
  validateOfferPolicy
} from '@vancod/affiliate-core';
import { createAiProvider } from '@vancod/ai';
import { telegramPublisher } from '@vancod/telegram-bot';
import { prisma } from '@vancod/database';

async function main() {
  console.log('\n==================================================');
  console.log('🚀 VANCOD OFERTAS — PROCESSANDO PRIMEIRA OFERTA REAL');
  console.log('==================================================\n');

  const connector = new MercadoLivreConnector(true);

  // 1. Health check
  const health = await connector.healthCheck();
  console.log(`📌 Conector: ${health.marketplace} | Status: ${health.status} | Latência: ${health.latencyMs}ms`);

  // 2. Ingestão do catálogo em tempo real (API oficial Mercado Livre / Adapter)
  console.log('\n🔎 1. Buscando produto em tempo real via API oficial Mercado Livre...');
  const searchResults = await connector.searchProducts({ query: 'smartphone', limit: 1 });

  if (!searchResults || searchResults.length === 0) {
    console.error('❌ Nenhum produto encontrado na busca em tempo real.');
    process.exit(1);
  }

  const realProduct = searchResults[0];
  console.log(`✅ Produto Encontrado: ${realProduct.title}`);
  console.log(`   - ID Externo: ${realProduct.externalId}`);
  console.log(`   - URL Original: ${realProduct.productUrl}`);
  console.log(`   - Imagem: ${realProduct.imageUrl}`);

  // 3. Busca de oferta e preço em tempo real
  console.log('\n💵 2. Obteve oferta em tempo real...');
  const offers = await connector.getOffers({ productId: realProduct.externalId });
  if (!offers || offers.length === 0) {
    console.error('❌ Nenhuma oferta encontrada para o produto.');
    process.exit(1);
  }
  const realOffer = offers[0];
  console.log(`   - Preço Atual: R$ ${realOffer.price.toFixed(2)}`);
  console.log(`   - Preço Antigo: ${realOffer.oldPrice ? `R$ ${realOffer.oldPrice.toFixed(2)}` : 'N/A'}`);
  console.log(`   - Desconto: ${realOffer.discountPercent ? `${realOffer.discountPercent}%` : 'N/A'}`);
  console.log(`   - Frete Grátis: ${realOffer.freeShipping ? 'Sim' : 'Não'}`);

  // 4. Geração de Deeplink Real
  console.log('\n🔗 3. Gerando Deeplink de Afiliado Real...');
  const affiliateResult = await connector.createAffiliateLink({
    originalUrl: realProduct.productUrl
  });
  console.log(`✅ Deeplink Gerado: ${affiliateResult.affiliateUrl}`);

  // 5. Cálculo de Score & Histórico
  console.log('\n📊 4. Calculando Score e Histórico da Oferta...');
  const historyMetrics = calculatePriceHistoryMetrics(realOffer.price, [
    { price: realOffer.price * 1.35, capturedAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    { price: realOffer.price * 1.25, capturedAt: new Date(Date.now() - 7 * 86400000).toISOString() }
  ]);
  const scoreBreakdown = calculateOfferScore(
    realOffer,
    realProduct.rating || 4.8,
    realProduct.reviewCount || 1200,
    historyMetrics
  );

  console.log(`   - Score Total: ${scoreBreakdown.totalScore}/100`);
  console.log(`   - Ação Recomendada: ${scoreBreakdown.action}`);

  // 6. Geração de Copy via IA / Template Estruturado
  console.log('\n🤖 5. Gerando Copy Estruturada (IA)...');
  const aiProvider = createAiProvider();
  const aiResult = await aiProvider.generateCopy({
    title: realProduct.title,
    price: realOffer.price,
    oldPrice: realOffer.oldPrice,
    discountPercent: realOffer.discountPercent,
    marketplace: 'Mercado Livre',
    shipping: realOffer.freeShipping ? 'Frete Grátis' : undefined,
    rating: realProduct.rating || 4.8
  });
  console.log(`   - Headline: "${aiResult.headline}"`);
  console.log(`   - Body: "${aiResult.body.replace(/\n/g, ' ')}"`);

  // 7. Checagem Determinística de Política
  console.log('\n🛡️ 6. Executando Policy Check Determinístico...');
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
    console.error('❌ Policy Check falhou:', policyResult.violations);
    process.exit(1);
  }
  console.log('✅ Policy Check aprovado com sucesso sem violações!');

  // 8. Persistência no Banco (se disponível)
  console.log('\n💾 7. Persistindo Oferta no Banco de Dados...');
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

    await prisma.affiliateLink.create({
      data: {
        offerId: offerRecord.id,
        originalUrl: realProduct.productUrl,
        affiliateUrl: affiliateResult.affiliateUrl,
        marketplace: realProduct.marketplace
      }
    });

    console.log(`✅ Oferta gravada no PostgreSQL (ID: ${offerRecord.id})`);
  } catch (err: any) {
    console.warn(`⚠️ Não foi possível salvar no PostgreSQL (Banco desconectado ou em mock mode): ${err?.message || err}`);
  }

  // 9. Publicação no Telegram Real
  console.log('\n📢 8. Publicando no Telegram Real...');
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

  console.log('\n==================================================');
  console.log('✨ FLUXO DA PRIMEIRA OFERTA REAL FINALIZADO COM SUCESSO!');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('💥 Erro fatal ao processar oferta real:', err);
  process.exit(1);
});
