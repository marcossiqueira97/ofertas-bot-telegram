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

async function main() {
  console.log('\n==================================================');
  console.log('🚀 VANCOD OFERTAS — INGESTÃO E PROCESSAMENTO FACTUAL DE OFERTA');
  console.log('==================================================\n');

  console.log('STATUS DAS CONFIGURAÇÕES:');
  console.log(`• REAL API: Mercado Livre Catalog API`);
  console.log(`• ACCESS TOKEN: ${env.MERCADOLIVRE_ACCESS_TOKEN ? 'Configurado' : 'Ausente (Necessário para buscas autenticadas na API)'}`);
  console.log(`• AFFILIATE TAG: ${env.MERCADOLIVRE_AFFILIATE_TAG ? env.MERCADOLIVRE_AFFILIATE_TAG : 'Ausente (Links serão emitidos como NOT_AVAILABLE)'}`);

  const connector = new MercadoLivreConnector(true);

  // 1. Health check
  const health = await connector.healthCheck();
  console.log(`\n📌 Conector: ${health.marketplace} | Status: ${health.status} | Latência: ${health.latencyMs}ms`);
  console.log(`   Affiliate Link Capability: ${connector.capabilities.affiliateLink ? 'Ativo' : 'Inativo (AFFILIATE STATUS = NOT_CONFIGURED)'}`);

  // 2. Ingestão factual em tempo real
  console.log('\n🔎 1. Buscando REAL PRODUCT na API oficial...');
  let searchResults;
  try {
    searchResults = await connector.searchProducts({ query: 'smartphone', limit: 1 });
  } catch (err: any) {
    console.error(`\n❌ FALHA NA BUSCA DE REAL PRODUCT DA API: ${err?.message || err}`);
    console.error(`💡 Para realizar buscas reais na API do Mercado Livre, configure MERCADOLIVRE_ACCESS_TOKEN no .env.`);
    process.exit(1);
  }

  if (!searchResults || searchResults.length === 0) {
    console.error('❌ Nenhum produto retornado pela API real.');
    process.exit(1);
  }

  const realProduct = searchResults[0];
  console.log(`✅ REAL PRODUCT: ${realProduct.title}`);
  console.log(`   - ID Externo: ${realProduct.externalId}`);
  console.log(`   - URL Original: ${realProduct.productUrl}`);
  console.log(`   - Imagem: ${realProduct.imageUrl || 'N/A'}`);

  // 3. Busca de oferta e preço em tempo real
  console.log('\n💵 2. Obteve REAL PRICE em tempo real...');
  const offers = await connector.getOffers({ productId: realProduct.externalId });
  if (!offers || offers.length === 0) {
    console.error('❌ Nenhuma oferta retornada pela API real para o produto.');
    process.exit(1);
  }
  const realOffer = offers[0];
  console.log(`✅ REAL PRICE: R$ ${realOffer.price.toFixed(2)}`);
  console.log(`   - Preço Antigo: ${realOffer.oldPrice ? `R$ ${realOffer.oldPrice.toFixed(2)}` : 'N/A'}`);
  console.log(`   - Desconto: ${realOffer.discountPercent ? `${realOffer.discountPercent}%` : 'N/A'}`);
  console.log(`   - Frete Grátis: ${realOffer.freeShipping ? 'Sim' : 'Não'}`);

  // 4. Deeplink de Afiliado
  console.log('\n🔗 3. Gerando Deeplink de Afiliado...');
  const affiliateResult = await connector.createAffiliateLink({
    originalUrl: realProduct.productUrl
  });
  console.log(`✅ AFFILIATE STATUS: ${affiliateResult.affiliateUrl === 'NOT_AVAILABLE' ? 'NOT_CONFIGURED (sem tag)' : 'CONFIGURED'}`);
  console.log(`   - Affiliate URL: ${affiliateResult.affiliateUrl}`);

  // 5. Cálculo de Score & Histórico
  console.log('\n📊 4. Calculando Score Factual...');
  const historyMetrics = calculatePriceHistoryMetrics(realOffer.price, []);
  const scoreBreakdown = calculateOfferScore(
    realOffer,
    realProduct.rating,
    realProduct.reviewCount,
    historyMetrics
  );

  console.log(`   - Score Total: ${scoreBreakdown.totalScore}/100`);
  console.log(`   - Ação Recomendada: ${scoreBreakdown.action}`);

  // 6. Geração de Copy via IA
  console.log('\n🤖 5. Gerando Copy Estruturada (IA)...');
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
    console.warn('⚠️ Policy Check reprovou publicação automática:', policyResult.violations);
  } else {
    console.log('✅ Policy Check aprovado com sucesso sem violações!');
  }

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

    console.log(`✅ Oferta gravada no PostgreSQL (ID: ${offerRecord.id})`);
  } catch (err: any) {
    console.warn(`⚠️ Não foi possível salvar no PostgreSQL (Banco desconectado ou credentials invalid): ${err?.message || err}`);
  }

  // 9. Publicação no Telegram Real
  console.log('\n📢 8. Publicando no Telegram Real...');
  if (affiliateResult.affiliateUrl === 'NOT_AVAILABLE') {
    console.log(`ℹ️ Publicação abortada por política: Oferta sem link de afiliado válido (AFFILIATE STATUS = NOT_CONFIGURED).`);
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
  console.log('✨ PROCESSAMENTO FACTUAL DA OFERTA CONCLUÍDO!');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('💥 Erro fatal:', err?.message || err);
  process.exit(1);
});
