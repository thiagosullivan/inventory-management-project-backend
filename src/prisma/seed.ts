// prisma/seed.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  MovementType,
  MovementStatus,
  TransferStatus,
  PurchaseRequestStatus,
} from "../generated/prisma/client.js";
import { auth } from "../lib/auth.js";
import { generatePrefix } from "../utils/generate-prefix.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Helper: N dias atrás (data relativa, sempre "recente")
function daysAgo(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Iniciando seed no NeonDB...");
  await prisma.$connect();
  console.log("✅ Conectado ao NeonDB");

  // ============================================
  // 1. SETORES
  // ============================================
  console.log("\n🏢 Criando setores...");

  const sectorsData = [
    {
      name: "Almoxarifado",
      description: "Setor central — único com estoque",
      isWarehouse: true,
    },
    {
      name: "Cozinha",
      description: "Setor de alimentação",
      isWarehouse: false,
    },
    {
      name: "Escola",
      description: "Setor escolar",
      isWarehouse: false,
    },
  ];

  const sectorMap = new Map<string, string>();

  for (const data of sectorsData) {
    const existing = await prisma.sector.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      sectorMap.set(data.name, existing.id);
      console.log(`   ℹ️ Setor já existe: ${data.name} (id: ${existing.id})`);
      continue;
    }

    const sector = await prisma.sector.create({ data });
    sectorMap.set(data.name, sector.id);
    console.log(
      `   ✅ Setor criado: ${data.name} (isWarehouse: ${data.isWarehouse}, id: ${sector.id})`,
    );
  }

  const sectorId = (name: string): string => {
    const id = sectorMap.get(name);
    if (!id) throw new Error(`Setor não encontrado no map: ${name}`);
    return id;
  };

  // ============================================
  // 2. USUÁRIOS
  // ============================================
  console.log("\n👤 Criando usuários...");

  // 2.1 MANAGER master
  const managerEmail = "admin@estoque.com";
  let admin = await prisma.user.findUnique({ where: { email: managerEmail } });

  if (!admin) {
    try {
      const response = await auth.api.signUpEmail({
        body: {
          email: managerEmail,
          password: "Admin@123",
          name: "Administrador",
          image: "...",
          sectorId: sectorId("Almoxarifado"),
        },
      });
      console.log("✅ Resposta do Better Auth (MANAGER):", response);

      admin = await prisma.user.findUnique({ where: { email: managerEmail } });
      if (admin) {
        admin = await prisma.user.update({
          where: { id: admin.id },
          data: {
            role: Role.MANAGER,
            isActive: true,
            sectorId: sectorId("Almoxarifado"),
          },
        });
      }
      console.log(
        `✅ MANAGER: ${admin?.email} / Admin@123 (setor: Almoxarifado, id: ${admin?.id})`,
      );
    } catch (error: any) {
      console.error("❌ Erro ao criar MANAGER:", error);
      throw error;
    }
  } else {
    console.log(`ℹ️ MANAGER já existe (id: ${admin.id})`);
  }

  if (!admin) throw new Error("Admin não encontrado após criação!");

  // 2.2 STAFF do Almoxarifado
  const staffAlmoxEmail = "almoxarifado@estoque.com";
  let staffAlmox = await prisma.user.findUnique({
    where: { email: staffAlmoxEmail },
  });

  if (!staffAlmox) {
    try {
      await auth.api.signUpEmail({
        body: {
          email: staffAlmoxEmail,
          password: "Staff@123",
          name: "Flávia Almoxarifado",
          image: "...",
          sectorId: sectorId("Almoxarifado"),
        },
      });
      staffAlmox = await prisma.user.findUnique({
        where: { email: staffAlmoxEmail },
      });
      if (staffAlmox) {
        staffAlmox = await prisma.user.update({
          where: { id: staffAlmox.id },
          data: {
            role: Role.STAFF,
            isActive: true,
            sectorId: sectorId("Almoxarifado"),
          },
        });
      }
      console.log(
        `✅ STAFF Almoxarifado: ${staffAlmox?.email} / Staff@123 (id: ${staffAlmox?.id})`,
      );
    } catch (error: any) {
      console.error("❌ Erro ao criar STAFF Almoxarifado:", error);
      throw error;
    }
  } else {
    console.log(`ℹ️ STAFF Almoxarifado já existe (id: ${staffAlmox.id})`);
  }

  // 2.2b STAFF do Almoxarifado (segundo)
  const staffAlmox2Email = "almoxarifado2@estoque.com";
  let staffAlmox2 = await prisma.user.findUnique({
    where: { email: staffAlmox2Email },
  });

  if (!staffAlmox2) {
    try {
      await auth.api.signUpEmail({
        body: {
          email: staffAlmox2Email,
          password: "Staff@123",
          name: "Jorge Almoxarifado",
          image: "...",
          sectorId: sectorId("Almoxarifado"),
        },
      });
      staffAlmox2 = await prisma.user.findUnique({
        where: { email: staffAlmox2Email },
      });
      if (staffAlmox2) {
        staffAlmox2 = await prisma.user.update({
          where: { id: staffAlmox2.id },
          data: {
            role: Role.STAFF,
            isActive: true,
            sectorId: sectorId("Almoxarifado"),
          },
        });
      }
      console.log(
        `✅ STAFF Almoxarifado 2: ${staffAlmox2?.email} / Staff@123 (id: ${staffAlmox2?.id})`,
      );
    } catch (error: any) {
      console.error("❌ Erro ao criar STAFF Almoxarifado 2:", error);
      throw error;
    }
  } else {
    console.log(`ℹ️ STAFF Almoxarifado 2 já existe (id: ${staffAlmox2.id})`);
  }

  // 2.3 STAFF da Cozinha
  const staffCozinhaEmail = "cozinha@estoque.com";
  let staffCozinha = await prisma.user.findUnique({
    where: { email: staffCozinhaEmail },
  });

  if (!staffCozinha) {
    try {
      await auth.api.signUpEmail({
        body: {
          email: staffCozinhaEmail,
          password: "Staff@123",
          name: "Lourdes Cozinha",
          image: "...",
          sectorId: sectorId("Cozinha"),
        },
      });
      staffCozinha = await prisma.user.findUnique({
        where: { email: staffCozinhaEmail },
      });
      if (staffCozinha) {
        staffCozinha = await prisma.user.update({
          where: { id: staffCozinha.id },
          data: {
            role: Role.STAFF,
            isActive: true,
            sectorId: sectorId("Cozinha"),
          },
        });
      }
      console.log(
        `✅ STAFF Cozinha: ${staffCozinha?.email} / Staff@123 (id: ${staffCozinha?.id})`,
      );
    } catch (error: any) {
      console.error("❌ Erro ao criar STAFF Cozinha:", error);
      throw error;
    }
  } else {
    console.log(`ℹ️ STAFF Cozinha já existe (id: ${staffCozinha.id})`);
  }

  // 2.4 STAFF da Escola
  const staffEscolaEmail = "escola@estoque.com";
  let staffEscola = await prisma.user.findUnique({
    where: { email: staffEscolaEmail },
  });

  if (!staffEscola) {
    try {
      await auth.api.signUpEmail({
        body: {
          email: staffEscolaEmail,
          password: "Staff@123",
          name: "Alcides Escola",
          image: "...",
          sectorId: sectorId("Escola"),
        },
      });
      staffEscola = await prisma.user.findUnique({
        where: { email: staffEscolaEmail },
      });
      if (staffEscola) {
        staffEscola = await prisma.user.update({
          where: { id: staffEscola.id },
          data: {
            role: Role.STAFF,
            isActive: true,
            sectorId: sectorId("Escola"),
          },
        });
      }
      console.log(
        `✅ STAFF Escola: ${staffEscola?.email} / Staff@123 (id: ${staffEscola?.id})`,
      );
    } catch (error: any) {
      console.error("❌ Erro ao criar STAFF Escola:", error);
      throw error;
    }
  } else {
    console.log(`ℹ️ STAFF Escola já existe (id: ${staffEscola.id})`);
  }

  if (!staffAlmox || !staffAlmox2 || !staffCozinha || !staffEscola) {
    throw new Error("Algum STAFF não foi criado/encontrado!");
  }

  // ============================================
  // 3. CATEGORIAS
  // ============================================
  console.log("\n📂 Criando categorias base...");
  const categoryNames = [
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
        data: { name, prefix, createdById: admin!.id },
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
  // 4. PRODUTOS
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
  const productIdBySku = new Map<string, string>();

  for (const productData of products) {
    const existingProduct = await prisma.product.findUnique({
      where: { sku: productData.sku },
    });

    if (existingProduct) {
      productIdBySku.set(productData.sku, existingProduct.id);
      console.log(
        `   ℹ️ Produto já existe: ${productData.name} (SKU: ${productData.sku})`,
      );
      continue;
    }

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          createdById: admin!.id,
          name: productData.name,
          sku: productData.sku,
          barcode: productData.barcode,
          categoryId: catId(productData.categoryName),
          priceInCents: productData.priceInCents,
          avgPriceInCents: productData.priceInCents,
          quantity: productData.quantity,
          minStock: productData.minStock,
          location: productData.location,
          supplier: productData.supplier,
          description: productData.description,
          imageUrl: productData.imageUrl,
          expiryDate: productData.expiryDate || null,
        },
      });

      if (product.quantity > 0) {
        const movement = await tx.movement.create({
          data: {
            productId: product.id,
            type: MovementType.ENTRADA,
            quantity: product.quantity,
            reason: "Entrada inicial (seed)",
            status: MovementStatus.CONCLUIDO,
            unitPriceInCents: productData.priceInCents,
            supplier: productData.supplier,
            createdById: admin!.id,
          },
        });

        await tx.stockHistory.create({
          data: {
            productId: product.id,
            oldQuantity: 0,
            newQuantity: product.quantity,
            movementId: movement.id,
            changedById: admin!.id,
            reason: "Criação do produto",
          },
        });
      } else {
        await tx.stockHistory.create({
          data: {
            productId: product.id,
            oldQuantity: 0,
            newQuantity: 0,
            changedById: admin!.id,
            reason: "Criação do produto",
          },
        });
      }

      return product;
    });

    productIdBySku.set(productData.sku, created.id);
    createdCount++;
    console.log(
      `   ✅ Produto criado: ${productData.name} (SKU: ${productData.sku}, barcode: ${productData.barcode})`,
    );
  }

  // ============================================
  // 4.5. AJUSTAR COUNTERS
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
  // 5. PEDIDO DE EXEMPLO (PurchaseRequest PENDENTE da Cozinha)
  // ============================================
  console.log("\n📝 Criando pedido de exemplo (Cozinha)...");

  const existingRequest = await prisma.purchaseRequest.findFirst({
    where: {
      sectorId: sectorId("Cozinha"),
      status: PurchaseRequestStatus.PENDENTE,
    },
  });

  let sampleRequest;
  if (existingRequest) {
    sampleRequest = existingRequest;
    console.log(`   ℹ️ Pedido PENDENTE já existe (id: ${existingRequest.id})`);
  } else {
    const detergenteId = productIdBySku.get("LIM-001");
    const aguaSanitariaId = productIdBySku.get("LIM-002");

    if (!detergenteId || !aguaSanitariaId) {
      throw new Error("Produtos de exemplo não encontrados para o pedido");
    }

    sampleRequest = await prisma.purchaseRequest.create({
      data: {
        sectorId: sectorId("Cozinha"),
        status: PurchaseRequestStatus.PENDENTE,
        notes: "Precisamos também de 2 vassouras (não cadastradas no sistema).",
        createdById: staffCozinha.id,
        items: {
          create: [
            { productId: detergenteId, quantity: 10 },
            { productId: aguaSanitariaId, quantity: 5 },
          ],
        },
      },
    });

    console.log(
      `   ✅ Pedido criado: ${sampleRequest.id} (Cozinha, PENDENTE, 2 itens)`,
    );
  }

  // ============================================
  // 6. REMESSA DE EXEMPLO (Transfer do Almoxarifado pra Cozinha, PENDENTE)
  // ============================================
  console.log("\n🚚 Criando remessa de exemplo (Almoxarifado → Cozinha)...");

  const existingTransfer = await prisma.transfer.findFirst({
    where: {
      toSectorId: sectorId("Cozinha"),
      status: TransferStatus.PENDENTE,
    },
  });

  if (existingTransfer) {
    console.log(
      `   ℹ️ Remessa PENDENTE já existe (id: ${existingTransfer.id})`,
    );
  } else {
    const papelA4Id = productIdBySku.get("ESC-001");
    const canetaId = productIdBySku.get("ESC-003");

    if (!papelA4Id || !canetaId) {
      throw new Error("Produtos de exemplo não encontrados para a remessa");
    }

    const transferItems = [
      { productId: papelA4Id, quantity: 20 },
      { productId: canetaId, quantity: 50 },
    ];

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Cozinha"),
          purchaseRequestId: null,
          status: TransferStatus.PENDENTE,
          reason: "Remessa de exemplo (seed)",
          createdById: staffAlmox.id,
          items: {
            create: transferItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
      });

      for (const item of transferItems) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { quantity: true, avgPriceInCents: true },
        });
        if (!product) {
          throw new Error(`Produto não encontrado: ${item.productId}`);
        }
        if (product.quantity < item.quantity) {
          throw new Error(
            `Estoque insuficiente para ${item.productId}: disponível ${product.quantity}, solicitado ${item.quantity}`,
          );
        }

        const movement = await tx.movement.create({
          data: {
            productId: item.productId,
            type: MovementType.TRANSFERENCIA,
            quantity: -item.quantity,
            reason: "Remessa de exemplo (seed)",
            status: MovementStatus.PENDENTE,
            fromSectorId: sectorId("Almoxarifado"),
            toSectorId: sectorId("Cozinha"),
            transferId: created.id,
            unitPriceInCents: product.avgPriceInCents,
            createdById: staffAlmox.id,
          },
        });

        const newQuantity = product.quantity - item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: newQuantity },
        });

        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            oldQuantity: product.quantity,
            newQuantity,
            movementId: movement.id,
            changedById: staffAlmox.id,
            reason: `Transferência para Cozinha (remessa ${created.id})`,
          },
        });
      }

      return created;
    });

    console.log(
      `   ✅ Remessa criada: ${transfer.id} (Almoxarifado → Cozinha, PENDENTE, 2 itens)`,
    );
  }

  // ============================================
  // 7. DADOS DE TESTE (cobrir todos os tipos/status)
  // ============================================

  console.log("\n🧪 Criando dados de teste (tipos/status variados)...");

  const productsByName = new Map(
    (await prisma.product.findMany()).map((p) => [p.name, p]),
  );

  function prodId(name: string): string {
    const p = productsByName.get(name);
    if (!p) throw new Error(`Produto não encontrado: ${name}`);
    return p.id;
  }

  // ------------------------------------------------------------
  // 7.1 — Movimentações manuais em ~30 dias (para paginação)
  //        ENTRADAs repõem, SAÍDAs/AJUSTEs consomem. Saldo coerente.
  //        ~30 movimentos extras → StockHistory > 20 em vários produtos.
  // ------------------------------------------------------------

  console.log("\n🧪 7.1 — Movimentações manuais espalhadas (~30 dias)...");

  // Helper: registra movement + atualiza Product.quantity + StockHistory
  async function addManualMovement(
    productName: string,
    type: MovementType,
    quantity: number, // positivo (o helper ajusta sinal conforme o tipo)
    reason: string,
    daysBack: number,
    createdById: string,
    supplier?: string,
  ) {
    await prisma.$transaction(async (tx) => {
      const p = await tx.product.findUnique({
        where: { id: prodId(productName) },
        select: { id: true, name: true, quantity: true, avgPriceInCents: true },
      });
      if (!p) throw new Error(`Produto não encontrado: ${productName}`);

      let newQuantity = p.quantity;
      let movementQuantity = quantity;
      let unitPriceInCents: number | null = p.avgPriceInCents;

      if (type === MovementType.ENTRADA) {
        newQuantity = p.quantity + quantity;
        movementQuantity = quantity;
        if (quantity > 0) {
          // média ponderada móvel (regra MYOB)
          const totalCost =
            (p.quantity || 0) * (p.avgPriceInCents || 0) +
            quantity * (p.avgPriceInCents || 0);
          const newAvg = Math.round(totalCost / newQuantity);
          await tx.product.update({
            where: { id: p.id },
            data: { quantity: newQuantity, avgPriceInCents: newAvg },
          });
        } else {
          await tx.product.update({
            where: { id: p.id },
            data: { quantity: newQuantity },
          });
        }
      } else if (type === MovementType.SAIDA) {
        if (p.quantity < quantity) {
          throw new Error(
            `Estoque insuficiente para ${productName}: ${p.quantity} < ${quantity}`,
          );
        }
        newQuantity = p.quantity - quantity;
        movementQuantity = -quantity;
        await tx.product.update({
          where: { id: p.id },
          data: { quantity: newQuantity },
        });
      } else if (type === MovementType.AJUSTE) {
        // ajuste pode ser positivo ou negativo; quantity recebido é delta
        newQuantity = p.quantity + quantity;
        if (newQuantity < 0) {
          throw new Error(
            `Ajuste deixaria estoque negativo em ${productName}: ${p.quantity} + ${quantity} = ${newQuantity}`,
          );
        }
        movementQuantity = quantity;
        await tx.product.update({
          where: { id: p.id },
          data: { quantity: newQuantity },
        });
      } else {
        throw new Error(`Tipo não suportado em addManualMovement: ${type}`);
      }

      const movement = await tx.movement.create({
        data: {
          productId: p.id,
          type,
          quantity: movementQuantity,
          reason,
          status: MovementStatus.CONCLUIDO,
          unitPriceInCents,
          supplier: supplier ?? null,
          fromSectorId: sectorId("Almoxarifado"),
          createdById,
          createdAt: daysAgo(daysBack, 10, 0),
        },
      });

      await tx.stockHistory.create({
        data: {
          productId: p.id,
          oldQuantity: p.quantity,
          newQuantity,
          movementId: movement.id,
          changedById: createdById,
          reason,
          changedAt: daysAgo(daysBack, 10, 0),
        },
      });
    });
  }

  // Verifica se já existe o conjunto de dados de teste de 7.1
  const existingBulk = await prisma.movement.findFirst({
    where: { reason: { contains: "Bulk seed" } },
  });

  if (existingBulk) {
    console.log("   ℹ️ Movimentações bulk já existem (pulando 7.1)");
  } else {
    // ---- Caneta (Estoque alto, pode gastar) ----
    // ENTRADAs
    await addManualMovement(
      "Caneta Esferográfica Azul",
      MovementType.ENTRADA,
      50,
      "Bulk seed — compra de canetas",
      28,
      staffAlmox.id,
      "Fornecedor A",
    );
    await addManualMovement(
      "Caneta Esferográfica Azul",
      MovementType.ENTRADA,
      30,
      "Bulk seed — reposição",
      21,
      staffAlmox.id,
      "Fornecedor A",
    );
    // SAÍDAs
    await addManualMovement(
      "Caneta Esferográfica Azul",
      MovementType.SAIDA,
      5,
      "Bulk seed — saída manual conferência",
      18,
      staffAlmox.id,
    );
    await addManualMovement(
      "Caneta Esferográfica Azul",
      MovementType.SAIDA,
      3,
      "Bulk seed — saída manual conferência",
      14,
      staffAlmox.id,
    );
    await addManualMovement(
      "Caneta Esferográfica Azul",
      MovementType.SAIDA,
      2,
      "Bulk seed — saída manual conferência",
      7,
      staffAlmox.id,
    );
    // AJUSTE
    await addManualMovement(
      "Caneta Esferográfica Azul",
      MovementType.AJUSTE,
      -1,
      "Bulk seed — ajuste de inventário",
      3,
      staffAlmox.id,
    );

    // ---- Detergente ----
    await addManualMovement(
      "Detergente Líquido 500ml",
      MovementType.ENTRADA,
      40,
      "Bulk seed — compra de detergente",
      27,
      staffAlmox.id,
      "Distribuidora de Limpeza",
    );
    await addManualMovement(
      "Detergente Líquido 500ml",
      MovementType.SAIDA,
      5,
      "Bulk seed — saída manual",
      20,
      staffAlmox.id,
    );
    await addManualMovement(
      "Detergente Líquido 500ml",
      MovementType.SAIDA,
      5,
      "Bulk seed — saída manual",
      12,
      staffAlmox.id,
    );
    await addManualMovement(
      "Detergente Líquido 500ml",
      MovementType.SAIDA,
      3,
      "Bulk seed — saída manual",
      5,
      staffAlmox.id,
    );

    // ---- Papel A4 ----
    await addManualMovement(
      "Papel A4 75g",
      MovementType.ENTRADA,
      100,
      "Bulk seed — compra de papel A4",
      26,
      staffAlmox.id,
      "Papelaria Central",
    );
    await addManualMovement(
      "Papel A4 75g",
      MovementType.SAIDA,
      10,
      "Bulk seed — saída manual",
      19,
      staffAlmox.id,
    );
    await addManualMovement(
      "Papel A4 75g",
      MovementType.SAIDA,
      8,
      "Bulk seed — saída manual",
      11,
      staffAlmox.id,
    );
    await addManualMovement(
      "Papel A4 75g",
      MovementType.SAIDA,
      4,
      "Bulk seed — saída manual",
      2,
      staffAlmox.id,
    );

    // ---- Água Sanitária ----
    await addManualMovement(
      "Água Sanitária 1L",
      MovementType.ENTRADA,
      20,
      "Bulk seed — compra de água sanitária",
      24,
      staffAlmox.id,
      "Distribuidora de Limpeza",
    );
    await addManualMovement(
      "Água Sanitária 1L",
      MovementType.SAIDA,
      3,
      "Bulk seed — saída manual",
      16,
      staffAlmox.id,
    );
    await addManualMovement(
      "Água Sanitária 1L",
      MovementType.SAIDA,
      2,
      "Bulk seed — saída manual",
      8,
      staffAlmox.id,
    );

    // ---- Parafuso 3x20mm ----
    await addManualMovement(
      "Parafuso 3x20mm",
      MovementType.ENTRADA,
      200,
      "Bulk seed — compra de parafusos",
      25,
      staffAlmox.id,
      "Loja de Ferragens",
    );
    await addManualMovement(
      "Parafuso 3x20mm",
      MovementType.SAIDA,
      30,
      "Bulk seed — saída manual",
      15,
      staffAlmox.id,
    );
    await addManualMovement(
      "Parafuso 3x20mm",
      MovementType.SAIDA,
      20,
      "Bulk seed — saída manual",
      6,
      staffAlmox.id,
    );

    // ---- Arroz ----
    await addManualMovement(
      "Arroz Integral 1kg",
      MovementType.ENTRADA,
      30,
      "Bulk seed — compra de arroz",
      23,
      staffAlmox.id,
      "Distribuidora Alimentos",
    );
    await addManualMovement(
      "Arroz Integral 1kg",
      MovementType.SAIDA,
      5,
      "Bulk seed — saída manual",
      10,
      staffAlmox.id,
    );

    // ---- Chave de Fenda ----
    await addManualMovement(
      "Chave de Fenda 6mm",
      MovementType.ENTRADA,
      10,
      "Bulk seed — compra de chaves",
      22,
      staffAlmox.id,
      "Loja de Ferragens",
    );
    await addManualMovement(
      "Chave de Fenda 6mm",
      MovementType.SAIDA,
      2,
      "Bulk seed — saída manual",
      9,
      staffAlmox.id,
    );

    // ---- Monitor ----
    await addManualMovement(
      'Monitor 24" LED',
      MovementType.ENTRADA,
      2,
      "Bulk seed — compra de monitores",
      17,
      staffAlmox.id,
      "Distribuidora de Informática",
    );
    await addManualMovement(
      'Monitor 24" LED',
      MovementType.SAIDA,
      1,
      "Bulk seed — saída manual",
      4,
      staffAlmox.id,
    );

    // ---- Caixa de Lápis de Cor ----
    await addManualMovement(
      "Caixa de Lápis de Cor 12 Cores",
      MovementType.ENTRADA,
      15,
      "Bulk seed — compra de lápis",
      13,
      staffAlmox.id,
      "Papelaria Central",
    );
    await addManualMovement(
      "Caixa de Lápis de Cor 12 Cores",
      MovementType.SAIDA,
      3,
      "Bulk seed — saída manual",
      1,
      staffAlmox.id,
    );

    // ---- Parafuso 4x40mm ----
    await addManualMovement(
      "Parafuso 4x40mm",
      MovementType.ENTRADA,
      300,
      "Bulk seed — compra de parafusos",
      28,
      staffAlmox.id,
      "Loja de Ferragens",
    );
    await addManualMovement(
      "Parafuso 4x40mm",
      MovementType.SAIDA,
      50,
      "Bulk seed — saída manual",
      11,
      staffAlmox.id,
    );

    console.log("   ✅ Movimentações bulk criadas (~30)");
  }

  // ------------------------------------------------------------
  // 7.2 — Transfer RECUSADO (Papel A4) — simula criação + recusa
  // ------------------------------------------------------------
  const existingRecusada = await prisma.transfer.findFirst({
    where: {
      toSectorId: sectorId("Escola"),
      status: TransferStatus.RECUSADO,
    },
  });
  if (!existingRecusada) {
    const t = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Escola"),
          status: TransferStatus.RECUSADO,
          reason: "Remessa de teste (recusada)",
          refusalReason: "Sem espaço para estoque",
          refusedById: staffEscola.id,
          refusedAt: daysAgo(9, 14, 30),
          createdById: staffAlmox.id,
          createdAt: daysAgo(9, 9, 0),
          items: {
            create: [{ productId: prodId("Papel A4 75g"), quantity: 2 }],
          },
        },
      });

      const product = await tx.product.findUnique({
        where: { id: prodId("Papel A4 75g") },
        select: { quantity: true, avgPriceInCents: true },
      });
      if (!product) throw new Error("Produto não encontrado");

      // 1) Débito na criação
      const qtyAfterCreate = product.quantity - 2;

      const movement = await tx.movement.create({
        data: {
          productId: prodId("Papel A4 75g"),
          type: MovementType.TRANSFERENCIA,
          quantity: -2,
          reason: `Remessa ${created.id} — Escola`,
          status: MovementStatus.RECUSADO,
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Escola"),
          transferId: created.id,
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffAlmox.id,
          createdAt: daysAgo(9, 9, 0),
        },
      });

      await tx.product.update({
        where: { id: prodId("Papel A4 75g") },
        data: { quantity: qtyAfterCreate },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Papel A4 75g"),
          oldQuantity: product.quantity,
          newQuantity: qtyAfterCreate,
          movementId: movement.id,
          changedById: staffAlmox.id,
          reason: `Remessa ${created.id} — Escola`,
          changedAt: daysAgo(9, 9, 0),
        },
      });

      // 2) Devolução na recusa
      const qtyAfterRefuse = qtyAfterCreate + 2;

      await tx.product.update({
        where: { id: prodId("Papel A4 75g") },
        data: { quantity: qtyAfterRefuse },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Papel A4 75g"),
          oldQuantity: qtyAfterCreate,
          newQuantity: qtyAfterRefuse,
          changedById: staffEscola.id,
          reason: `Devolução (recusa da remessa ${created.id}): Sem espaço para estoque`,
          changedAt: daysAgo(9, 14, 30),
        },
      });

      return created;
    });
    console.log(`   ✅ Transfer RECUSADO: ${t.id} (Movement + 2 StockHistory)`);
  } else {
    console.log(`   ℹ️ Transfer RECUSADO já existe (${existingRecusada.id})`);
  }

  // ------------------------------------------------------------
  // 7.3 — Transfer CANCELADO (Água Sanitária) — criação + cancelamento
  // ------------------------------------------------------------
  const existingCancelada = await prisma.transfer.findFirst({
    where: {
      toSectorId: sectorId("Cozinha"),
      status: TransferStatus.CANCELADO,
    },
  });
  if (!existingCancelada) {
    const t = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Cozinha"),
          status: TransferStatus.CANCELADO,
          cancelReason: "Item errado",
          cancelledById: staffAlmox.id,
          cancelledAt: daysAgo(6, 15, 0),
          createdById: staffAlmox.id,
          createdAt: daysAgo(6, 10, 0),
          items: {
            create: [{ productId: prodId("Água Sanitária 1L"), quantity: 1 }],
          },
        },
      });

      const product = await tx.product.findUnique({
        where: { id: prodId("Água Sanitária 1L") },
        select: { quantity: true, avgPriceInCents: true },
      });
      if (!product) throw new Error("Produto não encontrado");

      const qtyAfterCreate = product.quantity - 1;

      const movement = await tx.movement.create({
        data: {
          productId: prodId("Água Sanitária 1L"),
          type: MovementType.TRANSFERENCIA,
          quantity: -1,
          reason: `Remessa ${created.id} — Cozinha`,
          status: MovementStatus.CANCELADO,
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Cozinha"),
          transferId: created.id,
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffAlmox.id,
          createdAt: daysAgo(6, 10, 0),
        },
      });

      await tx.product.update({
        where: { id: prodId("Água Sanitária 1L") },
        data: { quantity: qtyAfterCreate },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Água Sanitária 1L"),
          oldQuantity: product.quantity,
          newQuantity: qtyAfterCreate,
          movementId: movement.id,
          changedById: staffAlmox.id,
          reason: `Remessa ${created.id} — Cozinha`,
          changedAt: daysAgo(6, 10, 0),
        },
      });

      const qtyAfterCancel = qtyAfterCreate + 1;

      await tx.product.update({
        where: { id: prodId("Água Sanitária 1L") },
        data: { quantity: qtyAfterCancel },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Água Sanitária 1L"),
          oldQuantity: qtyAfterCreate,
          newQuantity: qtyAfterCancel,
          changedById: staffAlmox.id,
          reason: `Devolução (cancelamento da remessa ${created.id}): Item errado`,
          changedAt: daysAgo(6, 15, 0),
        },
      });

      return created;
    });
    console.log(
      `   ✅ Transfer CANCELADO: ${t.id} (Movement + 2 StockHistory)`,
    );
  } else {
    console.log(`   ℹ️ Transfer CANCELADO já existe (${existingCancelada.id})`);
  }

  // ------------------------------------------------------------
  // 7.4 — Transfer CONCLUIDO (Detergente) — débito + SAIDA
  // ------------------------------------------------------------
  const existingConcluida = await prisma.transfer.findFirst({
    where: {
      toSectorId: sectorId("Cozinha"),
      status: TransferStatus.CONCLUIDO,
    },
  });
  if (!existingConcluida) {
    const t = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Cozinha"),
          status: TransferStatus.CONCLUIDO,
          confirmedById: staffCozinha.id,
          confirmedAt: daysAgo(8, 14, 0),
          createdById: staffAlmox.id,
          createdAt: daysAgo(8, 9, 0),
          items: {
            create: [
              { productId: prodId("Detergente Líquido 500ml"), quantity: 5 },
            ],
          },
        },
      });

      const product = await tx.product.findUnique({
        where: { id: prodId("Detergente Líquido 500ml") },
        select: { quantity: true, avgPriceInCents: true },
      });
      if (!product) throw new Error("Produto não encontrado");

      const newQty = product.quantity - 5;

      const transferMovement = await tx.movement.create({
        data: {
          productId: prodId("Detergente Líquido 500ml"),
          type: MovementType.TRANSFERENCIA,
          quantity: -5,
          reason: `Remessa ${created.id} — Cozinha`,
          status: MovementStatus.CONCLUIDO,
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Cozinha"),
          transferId: created.id,
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffAlmox.id,
          createdAt: daysAgo(8, 9, 0),
        },
      });

      await tx.movement.create({
        data: {
          productId: prodId("Detergente Líquido 500ml"),
          type: MovementType.SAIDA,
          quantity: -5,
          reason: `Remessa ${created.id} confirmada — Cozinha`,
          status: MovementStatus.CONCLUIDO,
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Cozinha"),
          transferId: created.id,
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffCozinha.id,
          createdAt: daysAgo(8, 14, 0),
        },
      });

      await tx.product.update({
        where: { id: prodId("Detergente Líquido 500ml") },
        data: { quantity: newQty },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Detergente Líquido 500ml"),
          oldQuantity: product.quantity,
          newQuantity: newQty,
          movementId: transferMovement.id,
          changedById: staffAlmox.id,
          reason: `Remessa ${created.id} — Cozinha`,
          changedAt: daysAgo(8, 9, 0),
        },
      });

      return created;
    });
    console.log(
      `   ✅ Transfer CONCLUIDO: ${t.id} (Movement TRANSFERENCIA + SAIDA + StockHistory)`,
    );
  } else {
    console.log(`   ℹ️ Transfer CONCLUIDO já existe (${existingConcluida.id})`);
  }

  // ------------------------------------------------------------
  // 7.5 — Transfer CONCLUIDO #2 (Papel A4, pra ter 2 SAIDAs)
  // ------------------------------------------------------------
  const existingConcluida2 = await prisma.transfer.findFirst({
    where: {
      toSectorId: sectorId("Escola"),
      status: TransferStatus.CONCLUIDO,
    },
  });
  if (!existingConcluida2) {
    const t = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Escola"),
          status: TransferStatus.CONCLUIDO,
          confirmedById: staffEscola.id,
          confirmedAt: daysAgo(3, 11, 0),
          createdById: staffAlmox.id,
          createdAt: daysAgo(3, 8, 0),
          items: {
            create: [{ productId: prodId("Papel A4 75g"), quantity: 10 }],
          },
        },
      });

      const product = await tx.product.findUnique({
        where: { id: prodId("Papel A4 75g") },
        select: { quantity: true, avgPriceInCents: true },
      });
      if (!product) throw new Error("Produto não encontrado");

      const newQty = product.quantity - 10;

      const transferMovement = await tx.movement.create({
        data: {
          productId: prodId("Papel A4 75g"),
          type: MovementType.TRANSFERENCIA,
          quantity: -10,
          reason: `Remessa ${created.id} — Escola`,
          status: MovementStatus.CONCLUIDO,
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Escola"),
          transferId: created.id,
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffAlmox.id,
          createdAt: daysAgo(3, 8, 0),
        },
      });

      await tx.movement.create({
        data: {
          productId: prodId("Papel A4 75g"),
          type: MovementType.SAIDA,
          quantity: -10,
          reason: `Remessa ${created.id} confirmada — Escola`,
          status: MovementStatus.CONCLUIDO,
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Escola"),
          transferId: created.id,
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffEscola.id,
          createdAt: daysAgo(3, 11, 0),
        },
      });

      await tx.product.update({
        where: { id: prodId("Papel A4 75g") },
        data: { quantity: newQty },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Papel A4 75g"),
          oldQuantity: product.quantity,
          newQuantity: newQty,
          movementId: transferMovement.id,
          changedById: staffAlmox.id,
          reason: `Remessa ${created.id} — Escola`,
          changedAt: daysAgo(3, 8, 0),
        },
      });

      return created;
    });
    console.log(
      `   ✅ Transfer CONCLUIDO #2: ${t.id} (Movement TRANSFERENCIA + SAIDA + StockHistory)`,
    );
  } else {
    console.log(
      `   ℹ️ Transfer CONCLUIDO #2 já existe (${existingConcluida2.id})`,
    );
  }

  // ------------------------------------------------------------
  // 7.6 — SAIDA manual extra (Parafuso 3x20mm)
  // ------------------------------------------------------------
  const existingSaidaManual = await prisma.movement.findFirst({
    where: {
      type: MovementType.SAIDA,
      transferId: null,
    },
  });
  if (!existingSaidaManual) {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: prodId("Parafuso 3x20mm") },
        select: { quantity: true, avgPriceInCents: true },
      });
      if (!product) throw new Error("Produto não encontrado");

      const qty = 5;
      const newQty = product.quantity - qty;
      if (newQty < 0) throw new Error("Estoque insuficiente para SAIDA manual");

      const movement = await tx.movement.create({
        data: {
          productId: prodId("Parafuso 3x20mm"),
          type: MovementType.SAIDA,
          quantity: -qty,
          reason: "Saída manual (seed) — conferência",
          status: MovementStatus.CONCLUIDO,
          fromSectorId: sectorId("Almoxarifado"),
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffAlmox.id,
          createdAt: daysAgo(2, 16, 0),
        },
      });

      await tx.product.update({
        where: { id: prodId("Parafuso 3x20mm") },
        data: { quantity: newQty },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Parafuso 3x20mm"),
          oldQuantity: product.quantity,
          newQuantity: newQty,
          movementId: movement.id,
          changedById: staffAlmox.id,
          reason: "Saída manual (seed)",
          changedAt: daysAgo(2, 16, 0),
        },
      });
    });
    console.log("   ✅ SAIDA manual criada (transferId: null) — testa R2b");
  } else {
    console.log(`   ℹ️ SAIDA manual já existe (${existingSaidaManual.id})`);
  }

  // ------------------------------------------------------------
  // 7.7 — AJUSTE extra (Arroz)
  // ------------------------------------------------------------
  const existingAjuste = await prisma.movement.findFirst({
    where: { type: MovementType.AJUSTE },
  });
  if (!existingAjuste) {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: prodId("Arroz Integral 1kg") },
        select: { quantity: true, avgPriceInCents: true },
      });
      if (!product) throw new Error("Produto não encontrado");

      const delta = 5;
      const newQty = product.quantity + delta;

      const movement = await tx.movement.create({
        data: {
          productId: prodId("Arroz Integral 1kg"),
          type: MovementType.AJUSTE,
          quantity: delta,
          reason: "Ajuste de inventário (seed)",
          status: MovementStatus.CONCLUIDO,
          fromSectorId: sectorId("Almoxarifado"),
          unitPriceInCents: product.avgPriceInCents,
          createdById: staffAlmox.id,
          createdAt: daysAgo(5, 11, 0),
        },
      });

      await tx.product.update({
        where: { id: prodId("Arroz Integral 1kg") },
        data: { quantity: newQty },
      });

      await tx.stockHistory.create({
        data: {
          productId: prodId("Arroz Integral 1kg"),
          oldQuantity: product.quantity,
          newQuantity: newQty,
          movementId: movement.id,
          changedById: staffAlmox.id,
          reason: "Ajuste de inventário (seed)",
          changedAt: daysAgo(5, 11, 0),
        },
      });
    });
    console.log("   ✅ AJUSTE criado (Almox)");
  } else {
    console.log(`   ℹ️ AJUSTE já existe (${existingAjuste.id})`);
  }

  // ------------------------------------------------------------
  // 7.8 — PurchaseRequest RECUSADO e CANCELADO
  //        (🔹 bugfix: "Giz de Cera" não existe → usa "Caixa de Lápis de Cor")
  // ------------------------------------------------------------
  const existingReqRecusado = await prisma.purchaseRequest.findFirst({
    where: { status: PurchaseRequestStatus.RECUSADO },
  });
  if (!existingReqRecusado) {
    await prisma.purchaseRequest.create({
      data: {
        sectorId: sectorId("Escola"),
        status: PurchaseRequestStatus.RECUSADO,
        refusalReason: "Item fora do catálogo",
        refusedById: staffAlmox.id,
        refusedAt: daysAgo(7, 10, 0),
        createdById: staffEscola.id,
        items: {
          create: [
            {
              productId: prodId("Caixa de Lápis de Cor 12 Cores"),
              quantity: 1,
            },
          ],
        },
      },
    });
    console.log("   ✅ PurchaseRequest RECUSADO criado");
  } else {
    console.log(`   ℹ️ PurchaseRequest RECUSADO já existe`);
  }

  const existingReqCancelado = await prisma.purchaseRequest.findFirst({
    where: { status: PurchaseRequestStatus.CANCELADO },
  });
  if (!existingReqCancelado) {
    await prisma.purchaseRequest.create({
      data: {
        sectorId: sectorId("Cozinha"),
        status: PurchaseRequestStatus.CANCELADO,
        createdById: staffCozinha.id,
        items: {
          create: [{ productId: prodId("Arroz Integral 1kg"), quantity: 2 }],
        },
      },
    });
    console.log("   ✅ PurchaseRequest CANCELADO criado");
  } else {
    console.log(`   ℹ️ PurchaseRequest CANCELADO já existe`);
  }

  // ============================================
  // 8. RESUMO
  // ============================================
  const totalMovements = await prisma.movement.count();
  const totalStockHistory = await prisma.stockHistory.count();
  const totalTransfers = await prisma.transfer.count();
  const totalRequests = await prisma.purchaseRequest.count();

  console.log("\n📊 ===== RESUMO =====");
  console.log(`🏢 Setores: ${sectorsData.length}`);
  console.log(`👤 Usuários: 5 (1 MANAGER + 4 STAFF)`);
  console.log(
    `   - STAFF: almoxarifado2@estoque.com / Staff@123 (Almoxarifado)`,
  );
  console.log(`📂 Categorias: ${categoryNames.length}`);
  console.log(`📦 Produtos criados: ${createdCount}`);
  console.log(`📦 Produtos existentes: ${products.length - createdCount}`);
  console.log(`\n📈 Movimentos totais: ${totalMovements}`);
  console.log(`📜 StockHistory totais: ${totalStockHistory}`);
  console.log(`🚚 Transfers totais: ${totalTransfers}`);
  console.log(`📝 PurchaseRequests totais: ${totalRequests}`);
  console.log(
    "\n💡 Dica: rode 'npx prisma migrate reset --force' pra recriar do zero e ver os dados de teste.",
  );
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
