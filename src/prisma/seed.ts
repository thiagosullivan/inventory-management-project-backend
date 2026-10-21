// prisma/seed.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  MovementType,
  MovementStatus,
} from "../generated/prisma/client.js";
import { auth } from "../lib/auth.js";
import { generatePrefix } from "../utils/generate-prefix.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed no NeonDB...");
  await prisma.$connect();
  console.log("✅ Conectado ao NeonDB");

  // ============================================
  // 1. USUÁRIO MANAGER
  // ============================================
  console.log("\n👤 Criando usuário MANAGER...");
  const managerEmail = "admin@estoque.com";
  let admin = await prisma.user.findUnique({ where: { email: managerEmail } });

  if (!admin) {
    try {
      const response = await auth.api.signUpEmail({
        body: {
          email: managerEmail,
          password: "Admin@123",
          name: "Administrador",
          image:
            "https://ui-avatars.com/api/?name=Admin&background=1a73e8&color=fff&size=128",
        },
      });
      console.log("✅ Resposta do Better Auth:", response);

      admin = await prisma.user.findUnique({ where: { email: managerEmail } });
      if (admin) {
        admin = await prisma.user.update({
          where: { id: admin.id },
          data: { role: Role.MANAGER, isActive: true },
        });
      }
      console.log(`✅ MANAGER: ${admin?.email} / Admin@123 (id: ${admin?.id})`);
    } catch (error: any) {
      console.error("❌ Erro ao criar MANAGER:", error);
      throw error;
    }
  } else {
    console.log(`ℹ️ MANAGER já existe (id: ${admin.id})`);
  }

  if (!admin) throw new Error("Admin não encontrado após criação!");

  // ============================================
  // 2. USUÁRIO STAFF
  // ============================================
  console.log("\n👤 Criando usuário STAFF...");
  const staffEmail = "funcionario@estoque.com";
  let staff = await prisma.user.findUnique({ where: { email: staffEmail } });

  if (!staff) {
    try {
      await auth.api.signUpEmail({
        body: {
          email: staffEmail,
          password: "Staff@123",
          name: "Funcionário Teste",
          image:
            "https://ui-avatars.com/api/?name=Staff&background=f57c00&color=fff&size=128",
        },
      });
      staff = await prisma.user.findUnique({ where: { email: staffEmail } });
      if (staff) {
        staff = await prisma.user.update({
          where: { id: staff.id },
          data: { role: Role.STAFF, isActive: true },
        });
      }
      console.log(`✅ STAFF: ${staff?.email} / Staff@123 (id: ${staff?.id})`);
    } catch (error: any) {
      console.error("❌ Erro ao criar STAFF:", error);
      throw error;
    }
  } else {
    console.log(`ℹ️ STAFF já existe (id: ${staff.id})`);
  }

  // ============================================
  // 3. CATEGORIAS (com prefix + counter)
  // ============================================
  console.log("\n📂 Criando categorias base...");
  const categoryNames = [
    "Almoxarifado",
    "Alimentos",
    "Limpeza",
    "Escritório",
    "Ferramentas",
    "Equipamentos",
    "Outros",
  ];
  const categoryMap = new Map<string, string>();

  const existingCats = await prisma.customCategory.findMany({
    select: { prefix: true },
  });
  const existingPrefixes = new Set(existingCats.map((c) => c.prefix));

  for (const name of categoryNames) {
    const existingCategory = await prisma.customCategory.findUnique({
      where: { name },
    });

    if (existingCategory) {
      categoryMap.set(name, existingCategory.id);
      console.log(
        `   ℹ️ ${name} (prefix: ${existingCategory.prefix}, id: ${existingCategory.id})`,
      );
      continue;
    }

    const prefix = generatePrefix(name, existingPrefixes);
    existingPrefixes.add(prefix);

    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.customCategory.create({
        data: { name, prefix, createdById: admin.id },
      });
      await tx.categoryCounter.create({
        data: { categoryId: created.id, lastNumber: 0 },
      });
      return created;
    });

    categoryMap.set(name, category.id);
    console.log(`   ✅ ${name} (prefix: ${prefix}, id: ${category.id})`);
  }

  const catId = (name: string): string => {
    const id = categoryMap.get(name);
    if (!id) throw new Error(`Categoria não encontrada no map: ${name}`);
    return id;
  };

  // ============================================
  // 4. PRODUTOS (com sku + barcode + preço)
  // ============================================
  console.log(`\n📦 Criando produtos para o admin: ${admin.id}`);

  const products = [
    {
      name: "Caneta Esferográfica Azul",
      sku: "ESC-003",
      barcode: "1000001",
      categoryName: "Escritório",
      priceInCents: 250,
      quantity: 100,
      minStock: 20,
      location: "Prateleira A1",
      supplier: "Fornecedor A",
      description: "Caneta esferográfica azul, ponta média",
      imageUrl:
        "https://cdn.iset.io/assets/50203/produtos/2149/caneta-esferogr-fica-1.0mm-cristal-azul-bic.jpg",
    },
    {
      name: "Arroz Integral 1kg",
      sku: "ALI-001",
      barcode: "1000002",
      categoryName: "Alimentos",
      priceInCents: 1500,
      quantity: 50,
      minStock: 10,
      location: "Prateleira B2",
      supplier: "Distribuidora Alimentos",
      description: "Arroz integral tipo 1, pacote 1kg",
      expiryDate: new Date("2025-12-31"),
      imageUrl:
        "https://mambodelivery.vtexassets.com/arquivos/ids/156847/arroz-integral-parboilizado-tio-joao-1kg.jpg",
    },
    {
      name: "Parafuso 3x20mm",
      sku: "FER-001",
      barcode: "1000003",
      categoryName: "Ferramentas",
      priceInCents: 15,
      quantity: 500,
      minStock: 100,
      location: "Gaveta C3",
      supplier: "Loja de Ferragens",
      description: "Parafuso para madeira 3x20mm, caixa com 1000 unidades",
      imageUrl:
        "https://cdn.leroymerlin.com.br/products/parafuso_aco_para_madeira_3x20mm_auto_atarraxante_20_pecas_86938285_a671_1800x1800.jpg",
    },
    {
      name: "Papel A4 75g",
      sku: "ESC-001",
      barcode: "1000004",
      categoryName: "Escritório",
      priceInCents: 2500,
      quantity: 200,
      minStock: 50,
      location: "Prateleira D1",
      supplier: "Papelaria Central",
      description: "Papel A4 75g, pacote com 500 folhas",
      imageUrl: "https://img.kalunga.com.br/fotosdeprodutos/476102z.jpg",
    },
    {
      name: "Detergente Líquido 500ml",
      sku: "LIM-001",
      barcode: "1000005",
      categoryName: "Limpeza",
      priceInCents: 200,
      quantity: 80,
      minStock: 15,
      location: "Prateleira E2",
      supplier: "Distribuidora de Limpeza",
      description: "Detergente líquido neutro 500ml",
      imageUrl:
        "https://beagaembalagem.com.br/wp-content/uploads/2014/09/detergente-ype-500-ml.jpg",
    },
    {
      name: "Chave de Fenda 6mm",
      sku: "FER-002",
      barcode: "1000006",
      categoryName: "Ferramentas",
      priceInCents: 850,
      quantity: 30,
      minStock: 10,
      location: "Gaveta C1",
      supplier: "Loja de Ferragens",
      description: "Chave de fenda 6mm, cabo de plástico",
      imageUrl:
        "https://palaciodasferramentas.com.br/media/catalog/product/W/T/WTEGEWNNUCYYVMMHVKLE.jpg",
    },
    {
      name: 'Monitor 24" LED',
      sku: "EQU-001",
      barcode: "1000007",
      categoryName: "Equipamentos",
      priceInCents: 65000,
      quantity: 5,
      minStock: 2,
      location: "Sala de TI",
      supplier: "Distribuidora de Informática",
      description: "Monitor LED 24 polegadas, Full HD",
      imageUrl:
        "https://cdn.awsli.com.br/2500x2500/954/954868/produto/310843687/20wr-75hz--4--qclw8gttpz.png",
    },
    {
      name: "Caixa de Lápis de Cor 12 Cores",
      sku: "ESC-002",
      barcode: "1000008",
      categoryName: "Escritório",
      priceInCents: 1200,
      quantity: 60,
      minStock: 15,
      location: "Prateleira A3",
      supplier: "Papelaria Central",
      description: "Caixa com 12 lápis de cor",
      imageUrl: "https://s3.amazonaws.com/lepok.w/produtos/produtos/00965.webp",
    },
    {
      name: "Água Sanitária 1L",
      sku: "LIM-002",
      barcode: "1000009",
      categoryName: "Limpeza",
      priceInCents: 400,
      quantity: 40,
      minStock: 10,
      location: "Prateleira E1",
      supplier: "Distribuidora de Limpeza",
      description: "Água sanitária 1L, hipoclorito de sódio 2,5%",
      imageUrl:
        "https://destro.fbitsstatic.net/img/p/agua-sanitaria-qboa-1l-70227/256763.jpg?w=500&h=500&v=202501231555&qs=ignore",
      expiryDate: new Date("2025-06-30"),
    },
    {
      name: "Parafuso 4x40mm",
      sku: "FER-003",
      barcode: "1000010",
      categoryName: "Ferramentas",
      priceInCents: 25,
      quantity: 800,
      minStock: 150,
      location: "Gaveta C4",
      supplier: "Loja de Ferragens",
      description: "Parafuso para madeira 4x40mm, caixa com 500 unidades",
      imageUrl:
        "https://cdn.ferramentaskennedy.com.br/storage/kennedy/510/parafuso-para-madeira-chipboard-4x40mm-com-500-pec-ciser17805873591791930.avif",
    },
  ];

  let createdCount = 0;

  for (const productData of products) {
    const existingProduct = await prisma.product.findUnique({
      where: { sku: productData.sku },
    });

    if (existingProduct) {
      console.log(
        `   ℹ️ Produto já existe: ${productData.name} (SKU: ${productData.sku})`,
      );
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          createdById: admin.id,
          name: productData.name,
          sku: productData.sku,
          barcode: productData.barcode,
          categoryId: catId(productData.categoryName),
          priceInCents: productData.priceInCents,
          avgPriceInCents: productData.priceInCents, // média = preço na primeira entrada
          quantity: productData.quantity,
          minStock: productData.minStock,
          location: productData.location,
          supplier: productData.supplier,
          description: productData.description,
          imageUrl: productData.imageUrl,
          expiryDate: productData.expiryDate || null,
        },
      });

      // Movement de ENTRADA inicial
      if (created.quantity > 0) {
        const movement = await tx.movement.create({
          data: {
            productId: created.id,
            type: MovementType.ENTRADA,
            quantity: created.quantity,
            reason: "Entrada inicial (seed)",
            status: MovementStatus.CONCLUIDO,
            unitPriceInCents: productData.priceInCents,
            supplier: productData.supplier,
            createdById: admin.id,
          },
        });

        await tx.stockHistory.create({
          data: {
            productId: created.id,
            oldQuantity: 0,
            newQuantity: created.quantity,
            movementId: movement.id,
            changedById: admin.id,
            reason: "Criação do produto",
          },
        });
      } else {
        await tx.stockHistory.create({
          data: {
            productId: created.id,
            oldQuantity: 0,
            newQuantity: 0,
            changedById: admin.id,
            reason: "Criação do produto",
          },
        });
      }
    });

    createdCount++;
    console.log(
      `   ✅ Produto criado: ${productData.name} (SKU: ${productData.sku}, barcode: ${productData.barcode})`,
    );
  }

  // ============================================
  // 4.5. AJUSTAR COUNTERS (SKU + barcode)
  // ============================================
  console.log("\n🔢 Ajustando counters...");

  for (const name of categoryNames) {
    const categoryId = catId(name);
    const catProducts = await prisma.product.findMany({
      where: { categoryId },
      select: { sku: true },
    });

    let maxNumber = 0;
    for (const p of catProducts) {
      const match = p.sku.match(/-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNumber) maxNumber = n;
      }
    }

    await prisma.categoryCounter.upsert({
      where: { categoryId },
      update: { lastNumber: maxNumber },
      create: { categoryId, lastNumber: maxNumber },
    });

    console.log(`   ✅ ${name}: lastNumber = ${maxNumber}`);
  }

  const allProducts = await prisma.product.findMany({
    select: { barcode: true },
  });
  let maxBarcode = 1000000;
  for (const p of allProducts) {
    const n = parseInt(p.barcode, 10);
    if (!isNaN(n) && n > maxBarcode) maxBarcode = n;
  }

  await prisma.productCounter.upsert({
    where: { id: "singleton" },
    update: { lastNumber: maxBarcode },
    create: { id: "singleton", lastNumber: maxBarcode },
  });
  console.log(`   ✅ ProductCounter: lastNumber = ${maxBarcode}`);

  // ============================================
  // 5. RESUMO
  // ============================================
  console.log("\n📊 ===== RESUMO =====");
  console.log(`📂 Categorias: ${categoryNames.length}`);
  console.log(`👤 Usuários:`);
  console.log(`   - MANAGER: admin@estoque.com / Admin@123`);
  console.log(`   - STAFF: funcionario@estoque.com / Staff@123`);
  console.log(`📦 Produtos criados: ${createdCount}`);
  console.log(`📦 Produtos existentes: ${products.length - createdCount}`);
  console.log("\n✅ Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("\n❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n👋 Desconectado do NeonDB");
  });
