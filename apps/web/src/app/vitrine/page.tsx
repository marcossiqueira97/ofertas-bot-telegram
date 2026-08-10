'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ShowcaseItem {
  id: string;
  marketplace: string;
  title: string;
  imageUrl: string;
  price: number;
  oldPrice?: number;
  discountPercent?: number;
  freeShipping?: boolean;
  couponCode?: string;
  rating?: number;
  affiliateUrl: string;
  category: string;
}

export default function VitrinePublicaPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [products] = useState<ShowcaseItem[]>([
    {
      id: 'v1',
      marketplace: 'shopee',
      title: 'Fone de Ouvido Bluetooth Sem Fio TWS i12 Premium',
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
      price: 39.9,
      oldPrice: 99.9,
      discountPercent: 60,
      freeShipping: true,
      couponCode: 'SHOPEE50',
      rating: 4.8,
      affiliateUrl: 'https://shopee.com.br/product/123/1001?shopee_affiliate_id=vancod_shopee_aff',
      category: 'Eletrônicos'
    },
    {
      id: 'v2',
      marketplace: 'aliexpress',
      title: 'Mini Projetor Portátil Magcubic HY300 4K Android 11 Wi-Fi 6',
      imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
      price: 219.0,
      oldPrice: 499.0,
      discountPercent: 56,
      freeShipping: true,
      rating: 4.9,
      affiliateUrl: 'https://s.click.aliexpress.com/e/_vancod_ali_aff',
      category: 'Projetores'
    },
    {
      id: 'v3',
      marketplace: 'amazon',
      title: 'Echo Dot 5ª Geração com Alexa | Smart Speaker Som de Alta Definição',
      imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',
      price: 269.1,
      oldPrice: 429.0,
      discountPercent: 37,
      freeShipping: true,
      rating: 4.8,
      affiliateUrl: 'https://amazon.com.br/dp/B09B2W722X?tag=vancod-20',
      category: 'Smart Home'
    },
    {
      id: 'v4',
      marketplace: 'mercadolivre',
      title: 'Fritadeira Sem Óleo Air Fryer Mondial Family 4L Inox 1500W',
      imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
      price: 249.9,
      oldPrice: 399.9,
      discountPercent: 37,
      freeShipping: true,
      couponCode: 'MONDIAL20',
      rating: 4.7,
      affiliateUrl: 'https://produto.mercadolivre.com.br/MLB3456789?matt_tool=vancod_ml_aff',
      category: 'Eletrodomésticos'
    },
    {
      id: 'v5',
      marketplace: 'magalu',
      title: 'Smart TV 50" 4K UHD Samsung Crystal CU7700 Wi-Fi Bluetooth',
      imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
      price: 2199.0,
      oldPrice: 2999.0,
      discountPercent: 26,
      freeShipping: true,
      rating: 4.8,
      affiliateUrl: 'https://www.magazinevoce.com.br/magazinevancod/p/mgl-5001',
      category: 'TV e Vídeo'
    }
  ]);

  const filteredProducts = products.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ background: '#090d16', color: '#fff', minHeight: '100vh', padding: '2rem 1.5rem' }}>
      <header
        style={{
          maxWidth: '1200px',
          margin: '0 auto 2rem auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.4rem'
            }}
          >
            V
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>Vancod Ofertas — Melhores Promoções do Dia</h1>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Ofertas verificadas com até 60% de desconto e Frete Grátis nas principais lojas!
            </p>
          </div>
        </div>

        <Link
          href="/"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: '#93c5fd',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '0.6rem 1.2rem',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}
        >
          ⚙️ Painel do Administrador
        </Link>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Banner de Boas Vindas */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '20px',
            padding: '2rem',
            marginBottom: '2rem',
            textAlign: 'center'
          }}
        >
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            🔥 As Melhores Ofertas do Brasil Atualizadas em Tempo Real
          </h2>
          <p style={{ color: '#93c5fd', fontSize: '0.95rem', maxWidth: '700px', margin: '0 auto' }}>
            Economize em eletrônicos, casa, moda e tecnologia. Todos os produtos possuem link seguro verificado.
          </p>
        </div>

        {/* Search & Category Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '2rem',
            flexWrap: 'wrap'
          }}
        >
          <input
            type="text"
            placeholder="🔍 O que você está procurando hoje?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '280px',
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              fontSize: '0.95rem',
              outline: 'none'
            }}
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              fontSize: '0.95rem',
              outline: 'none'
            }}
          >
            <option value="all">Todas as Categorias</option>
            <option value="Eletrônicos">Eletrônicos</option>
            <option value="Projetores">Projetores</option>
            <option value="Smart Home">Smart Home</option>
            <option value="Eletrodomésticos">Eletrodomésticos</option>
            <option value="TV e Vídeo">TV e Vídeo</option>
          </select>
        </div>

        {/* Products Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {filteredProducts.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#111827',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              <div style={{ position: 'relative', height: '200px', background: '#000' }}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {item.discountPercent && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#ef4444',
                      color: '#fff',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.8rem'
                    }}
                  >
                    -{item.discountPercent}% OFF
                  </span>
                )}
              </div>

              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.75rem' }}>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    height: '2.7rem'
                  }}
                >
                  {item.title}
                </h3>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>
                    R$ {item.price.toFixed(2)}
                  </span>
                  {item.oldPrice && (
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'line-through' }}>
                      R$ {item.oldPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {item.freeShipping && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#34d399',
                      background: 'rgba(16, 185, 129, 0.15)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      width: 'fit-content',
                      fontWeight: 600
                    }}
                  >
                    🚚 Frete Grátis
                  </span>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                  <a
                    href={item.affiliateUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                      color: '#fff',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}
                  >
                    🛒 Ir para a Loja Oficial
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
