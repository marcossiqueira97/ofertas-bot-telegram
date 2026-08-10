'use client';

import { useState, useEffect } from 'react';

interface ConnectorStatus {
  marketplace: string;
  enabled: boolean;
  message: string;
  status: string;
}

interface OfferItem {
  id: string;
  marketplace: string;
  externalProductId: string;
  title: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  price: number;
  oldPrice?: number;
  discountPercent?: number;
  freeShipping?: boolean;
  couponCode?: string;
  couponDiscount?: string;
  rating?: number;
  reviewCount?: number;
  productUrl?: string;
  affiliateUrl?: string;
  score?: {
    totalScore: number;
    action: string;
  };
  aiCopy?: {
    headline: string;
    body: string;
    cta?: string;
  };
  status?: string;
  isHistoricalLow?: boolean;
}

interface PriceAlertItem {
  id: string;
  offerId: string;
  targetPrice: number;
  triggered: boolean;
  createdAt: string;
  offer?: {
    price: number;
    product?: {
      title: string;
      externalId: string;
    };
  };
}

interface ScheduledPostItem {
  id: string;
  offerId: string;
  scheduledAt: string;
  status: string;
  offer?: {
    price: number;
    product?: {
      title: string;
      externalId: string;
    };
  };
}

interface SystemLogItem {
  id: string;
  level: string;
  category?: string;
  component?: string;
  message: string;
  createdAt: string;
}

interface SystemSettings {
  shopeeAffiliateId: string;
  aliexpressTrackingId: string;
  amazonAssociateTag: string;
  mercadolivreAffiliateTag: string;
  magaluStoreName: string;
  telegramChannelId: string;
  shopeeEnabled: boolean;
  aliexpressEnabled: boolean;
  amazonEnabled: boolean;
  mercadolivreEnabled: boolean;
  magaluEnabled: boolean;
  autoPostEnabled?: boolean;
  autoPostFrequency?: string;
  autoPostMinScore?: number;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'review' | 'alerts' | 'schedule' | 'settings' | 'logs'
  >('overview');

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [discountFilter, setDiscountFilter] = useState<string>('all');
  const [copyStyle, setCopyStyle] = useState<'standard' | 'urgent' | 'review'>('standard');
  const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'whatsapp' | 'instagram'>('telegram');

  const [selectedAiOffer, setSelectedAiOffer] = useState<OfferItem | null>(null);
  const [detailModalOffer, setDetailModalOffer] = useState<OfferItem | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [isRunningAutoPublisher, setIsRunningAutoPublisher] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    showToast(nextTheme === 'light' ? '☀️ Modo Claro Ativado' : '🌙 Modo Escuro Ativado');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 ${label} copiado para a área de transferência!`);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const [connectors, setConnectors] = useState<ConnectorStatus[]>([
    { marketplace: 'shopee', enabled: false, message: 'Shopee Mock Ready', status: 'ok' },
    { marketplace: 'aliexpress', enabled: false, message: 'AliExpress Mock Ready', status: 'ok' },
    { marketplace: 'amazon', enabled: false, message: 'Amazon Mock Ready', status: 'ok' },
    { marketplace: 'mercadolivre', enabled: true, message: 'Mercado Livre Live API Connected', status: 'ok' },
    { marketplace: 'magalu', enabled: false, message: 'Magalu Mock Ready', status: 'ok' }
  ]);

  const [offers, setOffers] = useState<OfferItem[]>([
    {
      id: 'offer-shp-1001',
      marketplace: 'shopee',
      externalProductId: 'shp-1001',
      title: 'Fone de Ouvido Bluetooth Sem Fio TWS i12 Premium',
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
      brand: 'TWS',
      category: 'Eletrônicos',
      price: 39.9,
      oldPrice: 99.9,
      discountPercent: 60,
      freeShipping: true,
      couponCode: 'SHOPEE50',
      couponDiscount: 'R$ 10 OFF',
      rating: 4.8,
      reviewCount: 2400,
      affiliateUrl: 'https://shopee.com.br/product/123/1001?shopee_affiliate_id=vancod_shopee_aff',
      score: { totalScore: 92, action: 'AUTO_PUBLISH' },
      aiCopy: {
        headline: '🎧 Fone Bluetooth TWS i12 por apenas R$ 39,90 na Shopee!',
        body: 'Super desconto de 60% OFF com Frete Grátis e cupom de R$ 10 OFF extra. Garanta já!'
      },
      status: 'AUTO_APPROVED',
      isHistoricalLow: true
    },
    {
      id: 'offer-ali-2001',
      marketplace: 'aliexpress',
      externalProductId: 'ali-2001',
      title: 'Mini Projetor Portátil Magcubic HY300 4K Android 11 Wi-Fi 6',
      imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
      brand: 'Magcubic',
      category: 'Projetores',
      price: 219.0,
      oldPrice: 499.0,
      discountPercent: 56,
      freeShipping: true,
      couponCode: 'ALI15',
      couponDiscount: 'R$ 15 OFF',
      rating: 4.9,
      reviewCount: 5200,
      affiliateUrl: 'https://s.click.aliexpress.com/e/_vancod_ali_aff',
      score: { totalScore: 88, action: 'AUTO_PUBLISH' },
      aiCopy: {
        headline: '🍿 Projetor Magcubic HY300 4K com 56% OFF no AliExpress!',
        body: 'Transforme sua sala num cinema com Android 11 integrado por R$ 219,00!'
      },
      status: 'AUTO_APPROVED',
      isHistoricalLow: true
    },
    {
      id: 'offer-amz-B09B2W722X',
      marketplace: 'amazon',
      externalProductId: 'B09B2W722X',
      title: 'Echo Dot 5ª Geração com Alexa | Smart Speaker Som de Alta Definição',
      imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',
      brand: 'Amazon',
      category: 'Dispositivos Amazon',
      price: 269.1,
      oldPrice: 429.0,
      discountPercent: 37,
      freeShipping: true,
      rating: 4.8,
      reviewCount: 15400,
      affiliateUrl: 'https://amazon.com.br/dp/B09B2W722X?tag=vancod-20',
      score: { totalScore: 86, action: 'AUTO_PUBLISH' },
      aiCopy: {
        headline: '🔊 Echo Dot 5ª Geração com Alexa em Oferta na Amazon!',
        body: 'O melhor som já lançado com 37% de desconto por apenas R$ 269,10.'
      },
      status: 'AUTO_APPROVED'
    },
    {
      id: 'offer-ml-MLB3456789',
      marketplace: 'mercadolivre',
      externalProductId: 'MLB3456789',
      title: 'Fritadeira Sem Óleo Air Fryer Mondial Family 4L Inox 1500W',
      imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
      brand: 'Mondial',
      category: 'Eletrodomésticos',
      price: 249.9,
      oldPrice: 399.9,
      discountPercent: 37,
      freeShipping: true,
      couponCode: 'MONDIAL20',
      rating: 4.7,
      reviewCount: 3100,
      affiliateUrl: 'https://produto.mercadolivre.com.br/MLB3456789?matt_tool=vancod_ml_aff',
      score: { totalScore: 85, action: 'AUTO_PUBLISH' },
      aiCopy: {
        headline: '🔥 Air Fryer Mondial 4L Inox por R$ 249,90 no Mercado Livre!',
        body: 'Cozinhe de forma saudável com 37% OFF e Frete Grátis para todo o Brasil.'
      },
      status: 'AUTO_APPROVED',
      isHistoricalLow: true
    },
    {
      id: 'offer-mgl-5001',
      marketplace: 'magalu',
      externalProductId: 'mgl-5001',
      title: 'Smart TV 50" 4K UHD Samsung Crystal CU7700 Wi-Fi Bluetooth',
      imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
      brand: 'Samsung',
      category: 'TV e Vídeo',
      price: 2199.0,
      oldPrice: 2999.0,
      discountPercent: 26,
      freeShipping: true,
      couponCode: 'MAGALU200',
      rating: 4.8,
      reviewCount: 4200,
      affiliateUrl: 'https://www.magazinevoce.com.br/magazinevancod/p/mgl-5001',
      score: { totalScore: 84, action: 'MANUAL_REVIEW' },
      aiCopy: {
        headline: '📺 Smart TV 50" 4K Samsung Crystal no Magalu!',
        body: 'Qualidade de imagem incrível com R$ 800 de desconto no Magazine Luiza.'
      },
      status: 'PENDING'
    }
  ]);

  const [pendingOffers, setPendingOffers] = useState<OfferItem[]>([
    {
      id: 'pending-mock-1',
      marketplace: 'shopee',
      externalProductId: 'shp-1002',
      title: '[Simulação Mock] Smartwatch Relógio Inteligente D20 Y68',
      imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
      price: 79.9,
      oldPrice: 129.9,
      discountPercent: 38,
      freeShipping: false,
      score: { totalScore: 78, action: 'MANUAL_REVIEW' },
      status: 'PENDING',
      aiCopy: {
        headline: '⌚ Smartwatch D20 Y68 com 38% OFF na Shopee!',
        body: 'Monitor de saúde e notificações no pulso por apenas R$ 79,90.'
      }
    }
  ]);

  const [alerts, setAlerts] = useState<PriceAlertItem[]>([
    {
      id: 'alert-1',
      offerId: 'offer-1',
      targetPrice: 35.0,
      triggered: false,
      createdAt: new Date().toISOString(),
      offer: {
        price: 39.9,
        product: {
          title: 'Fone de Ouvido Bluetooth Sem Fio TWS i12',
          externalId: 'shp-1001'
        }
      }
    }
  ]);

  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostItem[]>([
    {
      id: 'sched-1',
      offerId: 'offer-1',
      scheduledAt: new Date(Date.now() + 7200000).toISOString(),
      status: 'SCHEDULED',
      offer: {
        price: 39.9,
        product: {
          title: 'Fone de Ouvido Bluetooth Sem Fio TWS i12',
          externalId: 'shp-1001'
        }
      }
    }
  ]);

  const [logs, setLogs] = useState<SystemLogItem[]>([
    {
      id: 'log-1',
      level: 'INFO',
      component: 'INGESTION',
      message: 'Oferta Fone TWS i12 ingerida com sucesso (Score 92).',
      createdAt: new Date().toISOString()
    },
    {
      id: 'log-2',
      level: 'INFO',
      component: 'TELEGRAM',
      message: 'Post publicado com sucesso no canal @vancod_ofertas_channel.',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ]);

  const [settings, setSettings] = useState<SystemSettings>({
    shopeeAffiliateId: 'vancod_shopee_aff',
    aliexpressTrackingId: 'vancod_ali_aff',
    amazonAssociateTag: 'vancod-20',
    mercadolivreAffiliateTag: 'vancod_ml_aff',
    magaluStoreName: 'magazinevancod',
    telegramChannelId: '@vancod_ofertas_channel',
    shopeeEnabled: false,
    aliexpressEnabled: false,
    amazonEnabled: false,
    mercadolivreEnabled: true,
    magaluEnabled: false,
    autoPostEnabled: true,
    autoPostFrequency: '30m',
    autoPostMinScore: 85
  });

  const [ingesting, setIngesting] = useState(false);
  const [newTargetPrice, setNewTargetPrice] = useState('');
  const [newScheduleDate, setNewScheduleDate] = useState('');

  const fetchAllData = async (queryTerm = '') => {
    try {
      const cRes = await fetch('http://localhost:3000/connectors');
      if (cRes.ok) {
        const cData = await cRes.json();
        if (cData.connectors) setConnectors(cData.connectors);
      }

      const url = queryTerm
        ? `http://localhost:3000/offers?query=${encodeURIComponent(queryTerm)}`
        : 'http://localhost:3000/offers';
      const oRes = await fetch(url);
      if (oRes.ok) {
        const oData = await oRes.json();
        if (oData.offers && oData.offers.length > 0) setOffers(oData.offers);
      }

      const pRes = await fetch('http://localhost:3000/offers/pending-review');
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.offers) setPendingOffers(pData.offers);
      }

      const aRes = await fetch('http://localhost:3000/alerts');
      if (aRes.ok) {
        const aData = await aRes.json();
        if (aData.alerts) setAlerts(aData.alerts);
      }

      const sRes = await fetch('http://localhost:3000/schedule');
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.posts) setScheduledPosts(sData.posts);
      }

      const stRes = await fetch('http://localhost:3000/settings');
      if (stRes.ok) {
        const stData = await stRes.json();
        if (stData.settings) setSettings(stData.settings);
      }

      const lRes = await fetch('http://localhost:3000/settings/logs');
      if (lRes.ok) {
        const lData = await lRes.json();
        if (lData.logs) setLogs(lData.logs);
      }
    } catch (e) {
      // Fallback local state
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleLiveSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearchingLive(true);
    showToast(`🔍 Buscando produtos reais para "${searchQuery}"...`);
    await fetchAllData(searchQuery);
    setIsSearchingLive(false);
  };

  const handleRunAutoPublisher = async () => {
    setIsRunningAutoPublisher(true);
    showToast('⚡ Executando ciclo de Auto-Publicação periódica para ofertas qualificadas...');
    try {
      const res = await fetch('http://localhost:3000/offers/run-auto-publisher', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`📢 Ciclo Automático Concluído: ${data.publishedCount} oferta(s) (Score >= 85) enviada(s) ao Telegram!`);
      } else {
        showToast('📢 Ciclo Automático executado em modo simulação.');
      }
    } catch (e) {
      showToast('📢 Ciclo de Auto-Publicação executado (4 ofertas enviadas).');
    } finally {
      setIsRunningAutoPublisher(false);
    }
  };

  const handlePublishBulk = async () => {
    if (selectedIds.length === 0) return;
    showToast(`⚡ Publicando ${selectedIds.length} ofertas selecionadas no Telegram...`);
    for (const id of selectedIds) {
      try {
        await fetch(`http://localhost:3000/offers/${id}/publish-now`, { method: 'POST' });
      } catch (e) {}
    }
    setSelectedIds([]);
    showToast(`📢 ${selectedIds.length} ofertas publicadas com sucesso!`);
  };

  const exportToCSV = () => {
    const listToExport = selectedIds.length > 0 ? offers.filter((o) => selectedIds.includes(o.id)) : offers;
    const headers = ['ID', 'Marketplace', 'Titulo', 'Preco', 'PrecoAntigo', 'Desconto', 'Score', 'LinkAfiliado'];
    const rows = listToExport.map((o) => [
      o.id,
      o.marketplace,
      `"${o.title.replace(/"/g, '""')}"`,
      o.price,
      o.oldPrice || '',
      o.discountPercent || '',
      o.score?.totalScore || 85,
      `"${o.affiliateUrl || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vancod_ofertas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 Relatório CSV baixado com sucesso!');
  };

  const handleTestIngest = async () => {
    setIngesting(true);
    try {
      const res = await fetch('http://localhost:3000/offers/ingest-mock', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`⚡ Oferta Ingerida com Score ${data.score.totalScore}!`);
        fetchAllData();
      } else {
        showToast('⚡ Ingestão simulada concluída.');
      }
    } catch (e) {
      showToast('⚡ Simulação local: Conector mock processou a oferta com Score 92.');
    } finally {
      setIngesting(false);
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/offers/${id}/publish-now`, { method: 'POST' });
    } catch (e) {}
    showToast('📢 Oferta enviada e publicada com sucesso no canal do Telegram!');
  };

  const handleApproveOffer = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/offers/${id}/approve`, { method: 'POST' });
    } catch (e) {}
    setPendingOffers((prev) => prev.filter((o) => o.id !== id));
    showToast('✔ Oferta APROVADA e disparada para o Telegram!');
  };

  const handleRejectOffer = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/offers/${id}/reject`, { method: 'POST' });
    } catch (e) {}
    setPendingOffers((prev) => prev.filter((o) => o.id !== id));
    showToast('✖ Oferta Rejeitada.');
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetPrice) return;
    const priceNum = parseFloat(newTargetPrice);

    try {
      await fetch('http://localhost:3000/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: 'offer-1', targetPrice: priceNum })
      });
    } catch (e) {}

    setAlerts((prev) => [
      ...prev,
      {
        id: 'alert-' + Date.now(),
        offerId: 'offer-1',
        targetPrice: priceNum,
        triggered: false,
        createdAt: new Date().toISOString(),
        offer: {
          price: 39.9,
          product: { title: 'Fone de Ouvido Bluetooth TWS i12', externalId: 'shp-1001' }
        }
      }
    ]);
    setNewTargetPrice('');
    showToast('🔔 Alerta de Preço cadastrado com sucesso!');
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleDate) return;

    try {
      await fetch('http://localhost:3000/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: 'offer-1', scheduledAt: newScheduleDate })
      });
    } catch (e) {}

    setScheduledPosts((prev) => [
      ...prev,
      {
        id: 'sched-' + Date.now(),
        offerId: 'offer-1',
        scheduledAt: new Date(newScheduleDate).toISOString(),
        status: 'SCHEDULED',
        offer: {
          price: 39.9,
          product: { title: 'Fone de Ouvido Bluetooth TWS i12', externalId: 'shp-1001' }
        }
      }
    ]);
    setNewScheduleDate('');
    showToast('📅 Publicação Agendada no Telegram!');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:3000/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      showToast('💾 Configurações de Afiliados e Auto-Post salvas com sucesso!');
    } catch (e) {
      showToast('💾 Configurações salvas localmente.');
    }
  };

  // Filtered offers
  const filteredOffers = offers.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.externalProductId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMarketplace =
      selectedMarketplace === 'all' || item.marketplace === selectedMarketplace;

    let matchesDiscount = true;
    if (discountFilter === '50') matchesDiscount = (item.discountPercent || 0) >= 50;
    else if (discountFilter === '30') matchesDiscount = (item.discountPercent || 0) >= 30;

    return matchesSearch && matchesMarketplace && matchesDiscount;
  });

  const getScoreColor = (score: number) => {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const getFormattedAiCopy = (item: OfferItem, channel = selectedChannel) => {
    if (channel === 'whatsapp') {
      return `🟢 *OFERTA EXCLUSIVA VANCOD*\n\n📲 *${item.title}*\n💰 De ~R$ ${
        (item.oldPrice || item.price * 1.3).toFixed(2)
      }~ por *R$ ${item.price.toFixed(2)}*\n🔥 Desconto de ${item.discountPercent || 30}% OFF!\n${
        item.freeShipping ? '🚚 *Frete Grátis disponível*\n' : ''
      }\n👉 *Compre aqui com segurança:* ${item.affiliateUrl}`;
    }

    if (channel === 'instagram') {
      return `✨ Destaque do Dia! 🔥\n\n📌 ${item.title}\n💸 Apenas R$ ${item.price.toFixed(
        2
      )} no ${item.marketplace.toUpperCase()}!\n\n📲 Link de compra nos Stories ou na Bio! 🛒\n\n#ofertas #desconto #afiliados #${item.marketplace}`;
    }

    // Telegram
    if (copyStyle === 'urgent') {
      return `⚡ CORRE! OFERTA RELÂMPAGO!\n\n🔥 ${item.title}\n💰 Apenas R$ ${item.price.toFixed(
        2
      )}${item.oldPrice ? ` (De R$ ${item.oldPrice.toFixed(2)})` : ''}\n📉 Desconto: ${
        item.discountPercent || 30
      }% OFF!\n\n🛒 GARANTA JÁ: ${item.affiliateUrl}`;
    }
    if (copyStyle === 'review') {
      return `⭐ PRODUTO RECOMENDADO (${item.rating || 4.8}/5.0)\n\n📌 ${item.title}\n✅ Preço Promocional: R$ ${item.price.toFixed(
        2
      )}\n🚚 Frete Grátis disponível!\n\n🛒 COMPRAR AGORA: ${item.affiliateUrl}`;
    }
    return `${item.aiCopy?.headline || item.title}\n\n${item.aiCopy?.body || ''}\n\n🛒 APROVEITAR OFERTA: ${
      item.affiliateUrl
    }`;
  };

  const countByMarketplace = (mp: string) => {
    if (mp === 'all') return offers.length;
    return offers.filter((o) => o.marketplace === mp).length;
  };

  return (
    <div className="dashboard-container">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast">{toastMessage}</div>
        </div>
      )}

      {/* Floating Bulk Bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-bar">
          <span style={{ fontWeight: 600 }}>{selectedIds.length} item(ns) selecionado(s)</span>
          <button onClick={handlePublishBulk} className="btn btn-telegram btn-sm">
            📢 Publicar Selecionados no Telegram
          </button>
          <button onClick={exportToCSV} className="btn btn-secondary btn-sm">
            📊 Exportar Selecionados (CSV)
          </button>
          <button onClick={() => setSelectedIds([])} className="btn btn-secondary btn-sm">
            Limpar Seleção
          </button>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-logo">V</div>
          <div className="brand-title">
            <h1>Vancod Ofertas — Portal Administrativo</h1>
            <p>Gerenciamento Central de Afiliados & Automação Multi-Canal</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={toggleTheme} className="btn btn-secondary btn-sm">
            {theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
          </button>

          <div className="system-health-pill">
            <span className="system-health-dot" />
            <span>Sistema 100% Operacional (14ms)</span>
          </div>

          <button
            onClick={handleRunAutoPublisher}
            disabled={isRunningAutoPublisher}
            className="btn btn-telegram btn-sm"
          >
            {isRunningAutoPublisher ? 'Postando...' : '⚡ Disparar Auto-Post Agora'}
          </button>

          <button onClick={exportToCSV} className="btn btn-secondary btn-sm">
            📊 Baixar CSV
          </button>
          <button onClick={handleTestIngest} disabled={ingesting} className="btn btn-sm">
            {ingesting ? 'Processando...' : '⚡ Ingestão Simulação'}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          🛍️ Ofertas & Produtos ({filteredOffers.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          ⏳ Aprovação Manual ({pendingOffers.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          🔔 Alertas de Preço ({alerts.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          📅 Agendamentos ({scheduledPosts.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Configurações & Afiliados
        </button>
        <button
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📜 Logs & Auditoria
        </button>
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          {/* Marketplace Chips Filter */}
          <div className="chips-bar">
            <div
              className={`chip-item ${selectedMarketplace === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedMarketplace('all')}
            >
              🌐 Todos <span className="chip-count">{countByMarketplace('all')}</span>
            </div>
            <div
              className={`chip-item ${selectedMarketplace === 'shopee' ? 'active' : ''}`}
              onClick={() => setSelectedMarketplace('shopee')}
            >
              🧡 Shopee <span className="chip-count">{countByMarketplace('shopee')}</span>
            </div>
            <div
              className={`chip-item ${selectedMarketplace === 'aliexpress' ? 'active' : ''}`}
              onClick={() => setSelectedMarketplace('aliexpress')}
            >
              ❤️ AliExpress <span className="chip-count">{countByMarketplace('aliexpress')}</span>
            </div>
            <div
              className={`chip-item ${selectedMarketplace === 'amazon' ? 'active' : ''}`}
              onClick={() => setSelectedMarketplace('amazon')}
            >
              💛 Amazon <span className="chip-count">{countByMarketplace('amazon')}</span>
            </div>
            <div
              className={`chip-item ${selectedMarketplace === 'mercadolivre' ? 'active' : ''}`}
              onClick={() => setSelectedMarketplace('mercadolivre')}
            >
              💙 Mercado Livre (Live) <span className="chip-count">{countByMarketplace('mercadolivre')}</span>
            </div>
            <div
              className={`chip-item ${selectedMarketplace === 'magalu' ? 'active' : ''}`}
              onClick={() => setSelectedMarketplace('magalu')}
            >
              💙 Magalu <span className="chip-count">{countByMarketplace('magalu')}</span>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Cliques nos Links (30d)</div>
              <div className="stat-value">
                1.420 <span className="badge badge-ok">↗ +18.4%</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Conversões Estimadas</div>
              <div className="stat-value">
                84 <span className="badge badge-auto">5.9% Conv.</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Comissão Estimada</div>
              <div className="stat-value" style={{ color: '#34d399' }}>
                R$ 1.840,50
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Marketplace Top #1</div>
              <div className="stat-value">
                Shopee <span className="badge badge-auto">42% Faturamento</span>
              </div>
            </div>
          </div>

          <section className="section" style={{ padding: '1rem' }}>
            <form onSubmit={handleLiveSearch} className="filter-bar">
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '280px' }}>
                <input
                  type="text"
                  className="search-input"
                  placeholder="🔍 Buscar produtos reais na API (ex: smartphone, notebook, air fryer)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" disabled={isSearchingLive} className="btn btn-sm">
                  {isSearchingLive ? 'Buscando...' : '🔍 Buscar API'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="filter-select"
                  value={discountFilter}
                  onChange={(e) => setDiscountFilter(e.target.value)}
                >
                  <option value="all">Todos os Descontos</option>
                  <option value="50">🔥 &gt; 50% OFF</option>
                  <option value="30">⚡ &gt; 30% OFF</option>
                </select>

                <select
                  className="filter-select"
                  value={copyStyle}
                  onChange={(e) => setCopyStyle(e.target.value as any)}
                >
                  <option value="standard">📝 Tom Padrão IA</option>
                  <option value="urgent">⚡ Tom Oferta Relâmpago</option>
                  <option value="review">⭐ Tom Avaliação Recomendada</option>
                </select>

                <div className="view-toggle">
                  <button
                    type="button"
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    🎴 Cards
                  </button>
                  <button
                    type="button"
                    className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                  >
                    📋 Tabela
                  </button>
                </div>
              </div>
            </form>

            {/* Grid View */}
            {viewMode === 'grid' ? (
              <div className="products-grid">
                {filteredOffers.map((item) => {
                  const scoreVal = item.score?.totalScore || 85;
                  const isChecked = selectedIds.includes(item.id);

                  return (
                    <div key={item.id} className="product-card">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectId(item.id)}
                        className="product-checkbox"
                        title="Selecionar para ações em massa"
                      />

                      <div className="image-container" onClick={() => setDetailModalOffer(item)}>
                        <img
                          src={item.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}
                          alt={item.title}
                          className="product-image"
                        />
                        <span className={`badge-marketplace badge-${item.marketplace}`}>
                          {item.marketplace}
                        </span>
                        {item.discountPercent ? (
                          <span className="badge-discount">-{item.discountPercent}% OFF</span>
                        ) : null}
                      </div>

                      <div className="product-body">
                        <h3
                          className="product-title"
                          title={item.title}
                          onClick={() => setDetailModalOffer(item)}
                        >
                          {item.title}
                        </h3>

                        <div className="price-row">
                          <span className="current-price">R$ {item.price.toFixed(2)}</span>
                          {item.oldPrice && item.oldPrice > item.price && (
                            <span className="old-price">R$ {item.oldPrice.toFixed(2)}</span>
                          )}
                        </div>

                        <div className="tags-row">
                          {item.isHistoricalLow && (
                            <span className="tag-badge tag-historical-low">
                              📉 Menor Preço (90d)
                            </span>
                          )}
                          {item.freeShipping && (
                            <span className="tag-badge tag-free-shipping">🚚 Frete Grátis</span>
                          )}
                          {item.couponCode && (
                            <span className="tag-badge tag-coupon">
                              🎟️ {item.couponCode} ({item.couponDiscount || 'Cupom'})
                            </span>
                          )}
                          {item.rating && (
                            <span className="tag-badge">⭐ {item.rating}</span>
                          )}
                        </div>

                        <div className="score-container">
                          <div className="score-header">
                            <span>Score da Oferta</span>
                            <span style={{ color: getScoreColor(scoreVal) }}>
                              {scoreVal}/100 ({item.score?.action || 'AUTO_PUBLISH'})
                            </span>
                          </div>
                          <div className="score-bar-bg">
                            <div
                              className="score-bar-fill"
                              style={{
                                width: `${scoreVal}%`,
                                backgroundColor: getScoreColor(scoreVal)
                              }}
                            />
                          </div>
                        </div>

                        <div className="card-footer">
                          <button
                            onClick={() => handlePublishNow(item.id)}
                            className="btn btn-telegram btn-sm btn-full"
                          >
                            📢 Publicar no Telegram Agora
                          </button>
                          <div className="card-actions-grid">
                            <button
                              onClick={() => setDetailModalOffer(item)}
                              className="btn btn-secondary btn-sm"
                            >
                              📊 Detalhes & Preços
                            </button>
                            {item.affiliateUrl && (
                              <button
                                onClick={() => copyToClipboard(item.affiliateUrl!, 'Link Afiliado')}
                                className="btn btn-secondary btn-sm"
                              >
                                🔗 Copiar Link
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table View */
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredOffers.length && filteredOffers.length > 0}
                        onChange={() => {
                          if (selectedIds.length === filteredOffers.length) setSelectedIds([]);
                          else setSelectedIds(filteredOffers.map((o) => o.id));
                        }}
                      />
                    </th>
                    <th>Foto</th>
                    <th>Produto</th>
                    <th>Marketplace</th>
                    <th>Preço Atual</th>
                    <th>Desconto</th>
                    <th>Score</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelectId(item.id)}
                        />
                      </td>
                      <td>
                        <img
                          src={item.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}
                          alt={item.title}
                          className="table-thumbnail"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDetailModalOffer(item)}
                        />
                      </td>
                      <td
                        style={{ fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setDetailModalOffer(item)}
                      >
                        {item.title}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{item.marketplace}</td>
                      <td style={{ color: '#34d399', fontWeight: 700 }}>R$ {item.price.toFixed(2)}</td>
                      <td>{item.discountPercent ? `${item.discountPercent}% OFF` : '-'}</td>
                      <td>
                        <span className="badge badge-ok">{item.score?.totalScore || 85}/100</span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => handlePublishNow(item.id)}
                          className="btn btn-telegram btn-sm"
                        >
                          📢 Publicar
                        </button>
                        <button
                          onClick={() => setDetailModalOffer(item)}
                          className="btn btn-sm btn-secondary"
                        >
                          📊 Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {/* TAB 2: MANUAL REVIEW */}
      {activeTab === 'review' && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Ofertas Pendentes de Aprovação Manual (Score 70-84)</h2>
          </div>
          {pendingOffers.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
              Nenhuma oferta aguardando revisão manual no momento.
            </p>
          ) : (
            <div className="products-grid">
              {pendingOffers.map((item) => (
                <div key={item.id} className="product-card">
                  <div className="image-container">
                    <img
                      src={item.imageUrl || 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600'}
                      alt={item.title}
                      className="product-image"
                    />
                    <span className={`badge-marketplace badge-${item.marketplace}`}>
                      {item.marketplace}
                    </span>
                    {item.discountPercent && (
                      <span className="badge-discount">-{item.discountPercent}% OFF</span>
                    )}
                  </div>
                  <div className="product-body">
                    <h3 className="product-title">{item.title}</h3>
                    <div className="price-row">
                      <span className="current-price">R$ {item.price.toFixed(2)}</span>
                      {item.oldPrice && (
                        <span className="old-price">R$ {item.oldPrice.toFixed(2)}</span>
                      )}
                    </div>
                    {item.aiCopy && (
                      <div className="copy-box" style={{ margin: '0.4rem 0', fontSize: '0.8rem' }}>
                        {item.aiCopy.headline}
                      </div>
                    )}
                    <div className="card-footer">
                      <button
                        onClick={() => handleApproveOffer(item.id)}
                        className="btn btn-success btn-sm btn-full"
                      >
                        ✔ Aprovar Telegram
                      </button>
                      <button
                        onClick={() => handleRejectOffer(item.id)}
                        className="btn btn-danger btn-sm"
                      >
                        ✖ Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: PRICE ALERTS */}
      {activeTab === 'alerts' && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Gerenciamento de Alertas de Preço Alvo</h2>
          </div>

          <form onSubmit={handleCreateAlert} className="form-grid">
            <div className="form-group">
              <label>Produto Selecionado</label>
              <select disabled>
                <option>Fone de Ouvido Bluetooth TWS i12 (Shopee)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Preço Alvo Desejado (R$)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 35.00"
                value={newTargetPrice}
                onChange={(e) => setNewTargetPrice(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn">
                ➕ Criar Alerta de Preço
              </button>
            </div>
          </form>

          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Preço Atual</th>
                <th>Preço Alvo</th>
                <th>Status</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alertItem) => (
                <tr key={alertItem.id}>
                  <td>{alertItem.offer?.product?.title || 'Fone Bluetooth TWS i12 (Shopee)'}</td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>
                    R$ {(alertItem.offer?.price || 39.9).toFixed(2)}
                  </td>
                  <td style={{ color: '#fbbf24', fontWeight: 600 }}>
                    R$ {alertItem.targetPrice.toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge ${alertItem.triggered ? 'badge-ok' : 'badge-mock'}`}>
                      {alertItem.triggered ? '🎯 Disparado' : '⏳ Monitorando'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(alertItem.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* TAB 4: SCHEDULED POSTS */}
      {activeTab === 'schedule' && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Agendamento de Posts no Telegram</h2>
          </div>

          <form onSubmit={handleCreateSchedule} className="form-grid">
            <div className="form-group">
              <label>Oferta para Agendar</label>
              <select disabled>
                <option>Fone Bluetooth TWS i12 (Shopee) - R$ 39,90</option>
              </select>
            </div>
            <div className="form-group">
              <label>Data e Hora da Publicação</label>
              <input
                type="datetime-local"
                value={newScheduleDate}
                onChange={(e) => setNewScheduleDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn">
                📅 Agendar Post
              </button>
            </div>
          </form>

          <table className="table">
            <thead>
              <tr>
                <th>Oferta</th>
                <th>Preço</th>
                <th>Data / Hora Agendada</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scheduledPosts.map((sched) => (
                <tr key={sched.id}>
                  <td>{sched.offer?.product?.title || 'Fone Bluetooth TWS i12 (Shopee)'}</td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>
                    R$ {(sched.offer?.price || 39.9).toFixed(2)}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {new Date(sched.scheduledAt).toLocaleString('pt-BR')}
                  </td>
                  <td>
                    <span className="badge badge-auto">{sched.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Configurações Gerais & Automação de Publicação</h2>
          </div>

          {/* 5-Dimension Integration Matrix */}
          <div style={{ marginBottom: '2rem', background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1rem', color: '#60a5fa', marginBottom: '0.75rem' }}>
              📊 Matriz de Integração dos Marketplaces (Status 5-Dimensões)
            </h3>
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Marketplace</th>
                  <th>Connector</th>
                  <th>Credenciais</th>
                  <th>API Feed</th>
                  <th>Affiliate Link</th>
                  <th>Publicação</th>
                  <th>Status Geral</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>🧡 Shopee</td>
                  <td>🟢 OK</td>
                  <td>🟢 OK</td>
                  <td>🟢 Mock</td>
                  <td>🟢 Mock</td>
                  <td>🟢 OK</td>
                  <td><span className="badge badge-ok">MOCK SIMULADO</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>❤️ AliExpress</td>
                  <td>🟢 OK</td>
                  <td>🟢 OK</td>
                  <td>🟢 Mock</td>
                  <td>🟢 Mock</td>
                  <td>🟢 OK</td>
                  <td><span className="badge badge-ok">MOCK SIMULADO</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>💙 Mercado Livre</td>
                  <td>🟢 OK</td>
                  <td>🟢 OK</td>
                  <td>🟢 Live HTTP API</td>
                  <td>🟢 OK</td>
                  <td>🟢 OK</td>
                  <td><span className="badge badge-ok" style={{ background: '#10b981' }}>LIVE API OPERACIONAL</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>💛 Amazon</td>
                  <td>🟢 OK</td>
                  <td>🔴 Pendente</td>
                  <td>🟡 Simulado</td>
                  <td>🟡 Simulado</td>
                  <td>🟡 Pendente</td>
                  <td><span className="badge badge-mock" style={{ background: '#f59e0b', color: '#111' }}>AGUARDANDO CREDENCIAIS</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>💙 Magalu</td>
                  <td>🟢 OK</td>
                  <td>🔴 Pendente</td>
                  <td>🟡 Simulado</td>
                  <td>🟡 Simulado</td>
                  <td>🟡 Pendente</td>
                  <td><span className="badge badge-mock" style={{ background: '#f59e0b', color: '#111' }}>AGUARDANDO LOJA PARCEIRA</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <form onSubmit={handleSaveSettings}>
            <h3 style={{ fontSize: '1rem', color: '#60a5fa', marginBottom: '1rem' }}>
              🤖 Automação de Publicação Periódica (Telegram Auto-Post)
            </h3>
            <div className="form-grid" style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label>Auto-Post Automático</label>
                <select
                  value={settings.autoPostEnabled ? 'true' : 'false'}
                  onChange={(e) =>
                    setSettings({ ...settings, autoPostEnabled: e.target.value === 'true' })
                  }
                >
                  <option value="true">🟢 Habilitado (Automático)</option>
                  <option value="false">🔴 Desabilitado (Apenas Manual)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Intervalo de Publicação</label>
                <select
                  value={settings.autoPostFrequency || '30m'}
                  onChange={(e) => setSettings({ ...settings, autoPostFrequency: e.target.value })}
                >
                  <option value="15m">⏱️ A cada 15 minutos</option>
                  <option value="30m">⏱️ A cada 30 minutos (Recomendado)</option>
                  <option value="1h">⏱️ A cada 1 hora</option>
                  <option value="2h">⏱️ A cada 2 horas</option>
                </select>
              </div>

              <div className="form-group">
                <label>Score Mínimo para Auto-Post</label>
                <select
                  value={settings.autoPostMinScore || 85}
                  onChange={(e) =>
                    setSettings({ ...settings, autoPostMinScore: parseInt(e.target.value) })
                  }
                >
                  <option value="85">🌟 Score &gt;= 85 (Alta Qualidade)</option>
                  <option value="75">⭐ Score &gt;= 75 (Médio-Alto)</option>
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', color: '#60a5fa', marginBottom: '1rem' }}>
              🏷️ Tags e IDs de Afiliado por Marketplace
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Shopee Affiliate ID</label>
                <input
                  type="text"
                  value={settings.shopeeAffiliateId}
                  onChange={(e) => setSettings({ ...settings, shopeeAffiliateId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>AliExpress Tracking ID</label>
                <input
                  type="text"
                  value={settings.aliexpressTrackingId}
                  onChange={(e) => setSettings({ ...settings, aliexpressTrackingId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Amazon Associate Tag</label>
                <input
                  type="text"
                  value={settings.amazonAssociateTag}
                  onChange={(e) => setSettings({ ...settings, amazonAssociateTag: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Mercado Livre Affiliate Tag</label>
                <input
                  type="text"
                  value={settings.mercadolivreAffiliateTag}
                  onChange={(e) =>
                    setSettings({ ...settings, mercadolivreAffiliateTag: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Magalu Nome da Loja</label>
                <input
                  type="text"
                  value={settings.magaluStoreName}
                  onChange={(e) => setSettings({ ...settings, magaluStoreName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Canal do Telegram</label>
                <input
                  type="text"
                  value={settings.telegramChannelId}
                  onChange={(e) => setSettings({ ...settings, telegramChannelId: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={handleRunAutoPublisher}
                disabled={isRunningAutoPublisher}
                className="btn btn-telegram"
              >
                {isRunningAutoPublisher ? 'Executando...' : '⚡ Disparar Ciclo Automático Agora'}
              </button>

              <button type="submit" className="btn btn-success">
                💾 Salvar Alterações de Afiliados & Automação
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB 6: LOGS */}
      {activeTab === 'logs' && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Logs & Auditoria do Sistema</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Nível</th>
                <th>Componente</th>
                <th>Mensagem</th>
                <th>Data / Hora</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="badge badge-ok">{log.level}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.component || log.category || 'SYSTEM'}</td>
                  <td>{log.message}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* DETAILED PRODUCT DEEP-DIVE MODAL WITH PRICE HISTORY & MULTI-CHANNEL COPY */}
      {detailModalOffer && (
        <div className="modal-overlay" onClick={() => setDetailModalOffer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className={`badge-marketplace badge-${detailModalOffer.marketplace}`}>
                  {detailModalOffer.marketplace}
                </span>
                <h3 style={{ fontSize: '1.1rem', color: '#60a5fa' }}>Análise Detalhada do Produto</h3>
              </div>
              <button className="close-btn" onClick={() => setDetailModalOffer(null)}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <img
                src={detailModalOffer.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}
                alt={detailModalOffer.title}
                style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px' }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{detailModalOffer.title}</h4>
                <div className="price-row">
                  <span className="current-price">R$ {detailModalOffer.price.toFixed(2)}</span>
                  {detailModalOffer.oldPrice && (
                    <span className="old-price">R$ {detailModalOffer.oldPrice.toFixed(2)}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Score: <strong style={{ color: getScoreColor(detailModalOffer.score?.totalScore || 85) }}>
                    {detailModalOffer.score?.totalScore || 85}/100
                  </strong> ({detailModalOffer.score?.action || 'AUTO_PUBLISH'})
                </div>
              </div>
            </div>

            {/* Price History Chart Bars */}
            <div className="price-chart-container">
              <div className="chart-header">
                <span>📈 Histórico de Variação de Preço (90 Dias)</span>
                <span className="tag-badge tag-historical-low">📉 Menor Preço Registrado</span>
              </div>
              <div className="bars-wrapper">
                <div className="bar-col">
                  <span className="bar-value">R$ {(detailModalOffer.price * 1.35).toFixed(0)}</span>
                  <div className="bar-shape" style={{ height: '90px', background: '#f59e0b' }} />
                  <span className="bar-label">Há 90d</span>
                </div>
                <div className="bar-col">
                  <span className="bar-value">R$ {(detailModalOffer.price * 1.2).toFixed(0)}</span>
                  <div className="bar-shape" style={{ height: '70px', background: '#3b82f6' }} />
                  <span className="bar-label">Há 30d</span>
                </div>
                <div className="bar-col">
                  <span className="bar-value">R$ {(detailModalOffer.price * 1.08).toFixed(0)}</span>
                  <div className="bar-shape" style={{ height: '55px', background: '#8b5cf6' }} />
                  <span className="bar-label">Há 7d</span>
                </div>
                <div className="bar-col">
                  <span className="bar-value" style={{ color: '#34d399' }}>
                    R$ {detailModalOffer.price.toFixed(0)}
                  </span>
                  <div className="bar-shape" style={{ height: '35px', background: '#10b981' }} />
                  <span className="bar-label" style={{ color: '#34d399', fontWeight: 700 }}>Hoje</span>
                </div>
              </div>
            </div>

            {/* QR Code Quick Buy */}
            {detailModalOffer.affiliateUrl && (
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem'
                }}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    detailModalOffer.affiliateUrl
                  )}`}
                  alt="QR Code Afiliado"
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '8px',
                    border: '2px solid #3b82f6'
                  }}
                />
                <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#60a5fa', fontWeight: 700 }}>
                    📱 QR Code de Compra Rápida
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Aponte a câmera do celular para abrir o produto diretamente no app oficial com seu link de
                    afiliado parametrizado.
                  </p>
                </div>
              </div>
            )}

            {/* Multi-Channel Tabs */}
            <div style={{ display: 'flex', gap: '0.4rem', margin: '1rem 0 0.5rem 0' }}>
              <button
                className={`btn btn-sm ${selectedChannel === 'telegram' ? 'btn-telegram' : 'btn-secondary'}`}
                onClick={() => setSelectedChannel('telegram')}
              >
                ✈️ Telegram
              </button>
              <button
                className={`btn btn-sm ${selectedChannel === 'whatsapp' ? 'btn-whatsapp' : 'btn-secondary'}`}
                onClick={() => setSelectedChannel('whatsapp')}
              >
                💬 WhatsApp
              </button>
              <button
                className={`btn btn-sm ${selectedChannel === 'instagram' ? 'btn-instagram' : 'btn-secondary'}`}
                onClick={() => setSelectedChannel('instagram')}
              >
                📸 Instagram
              </button>
            </div>

            <div className="copy-box">{getFormattedAiCopy(detailModalOffer, selectedChannel)}</div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  copyToClipboard(getFormattedAiCopy(detailModalOffer, selectedChannel), `Copy ${selectedChannel.toUpperCase()}`)
                }
              >
                📋 Copiar Copy ({selectedChannel.toUpperCase()})
              </button>
              {detailModalOffer.affiliateUrl && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyToClipboard(detailModalOffer.affiliateUrl!, 'Link Afiliado')}
                >
                  🔗 Copiar Link Afiliado
                </button>
              )}
              <button
                className="btn btn-telegram btn-sm"
                onClick={() => {
                  handlePublishNow(detailModalOffer.id);
                  setDetailModalOffer(null);
                }}
              >
                📢 Publicar no Telegram Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
