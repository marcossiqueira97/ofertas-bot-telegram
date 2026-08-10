import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INITIAL_MARKETPLACES = [
  { name: 'Shopee', slug: 'shopee', enabled: true },
  { name: 'AliExpress', slug: 'aliexpress', enabled: true },
  { name: 'Amazon', slug: 'amazon', enabled: false },
  { name: 'Mercado Livre', slug: 'mercadolivre', enabled: false },
  { name: 'Magalu', slug: 'magalu', enabled: false }
];

const INITIAL_CATEGORIES = [
  { name: 'Eletrônicos', slug: 'eletronicos' },
  { name: 'Casa e Cozinha', slug: 'casa-e-cozinha' },
  { name: 'Moda e Acessórios', slug: 'moda-e-acessorios' },
  { name: 'Informática', slug: 'informatica' },
  { name: 'Beleza e Saúde', slug: 'beleza-e-saude' }
];

async function main() {
  console.log('Seeding initial data into database...');

  for (const m of INITIAL_MARKETPLACES) {
    await prisma.marketplace.upsert({
      where: { slug: m.slug },
      update: { enabled: m.enabled },
      create: m
    });
  }

  for (const c of INITIAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c
    });
  }

  console.log('Database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
