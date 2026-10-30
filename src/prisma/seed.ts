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

async function main() {
  console.log("🌱 Iniciando seed no NeonDB...");
  await prisma.$connect();
  console.log("✅ Conectado ao NeonDB");

  // ============================================
  // 1. SETORES (🔹 NOVO — cria ANTES dos usuários)
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

  const sectorMap = new Map<string, string>(); // name → id

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
  // 2. USUÁRIOS (MANAGER master + 3 STAFF, um por setor)
  // ============================================
  console.log("\n👤 Criando usuários...");

  // 2.1 MANAGER master (Almoxarifado)
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
  const staffAlmoxEmail = "almoxarife@estoque.com";
  let staffAlmox = await prisma.user.findUnique({
    where: { email: staffAlmoxEmail },
  });

  if (!staffAlmox) {
    try {
      await auth.api.signUpEmail({
        body: {
          email: staffAlmoxEmail,
          password: "Staff@123",
          name: "Almoxarife Teste",
          image: "...",
          sectorId: sectorId("Almoxarifado"), // 🔹 NOVO
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
          name: "Cozinheira Teste",
          image: "...",
          sectorId: sectorId("Cozinha"), // 🔹 NOVO
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
          name: "Escola Teste",
          image: "...",
          sectorId: sectorId("Escola"), // 🔹 NOVO
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

  if (!staffAlmox || !staffCozinha || !staffEscola) {
    throw new Error("Algum STAFF não foi criado/encontrado!");
  }

  // ============================================
  // 3. CATEGORIAS (com prefix + counter)
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

      // Movement de ENTRADA inicial (só se quantity > 0)
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
    // Pega 2 produtos pra compor o pedido (detergente + água sanitária — itens de limpeza, típicos de cozinha)
    const detergenteId = productIdBySku.get("LIM-001"); // Detergente
    const aguaSanitariaId = productIdBySku.get("LIM-002"); // Água Sanitária

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
  // 6. REMESSA DE EXEMPLO (Transfer do Almoxarifado pra Cozinha)
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
    const papelA4Id = productIdBySku.get("ESC-001"); // Papel A4
    const canetaId = productIdBySku.get("ESC-003"); // Caneta

    if (!papelA4Id || !canetaId) {
      throw new Error("Produtos de exemplo não encontrados para a remessa");
    }

    // Produtos que vão na remessa (qtds que serão debitadas do estoque do Almoxarifado)
    const transferItems = [
      { productId: papelA4Id, quantity: 20 },
      { productId: canetaId, quantity: 50 },
    ];

    // 🔹 Transação atômica: cria Transfer + TransferItem + Movement (TRANSFERENCIA, PENDENTE) + StockHistory + debita Product.quantity
    const transfer = await prisma.$transaction(async (tx) => {
      // 1. Criar Transfer (header)
      const created = await tx.transfer.create({
        data: {
          fromSectorId: sectorId("Almoxarifado"),
          toSectorId: sectorId("Cozinha"),
          purchaseRequestId: null, // remessa avulsa (não vinculada ao pedido de exemplo)
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

      // 2. Para cada item: debita Product.quantity + cria Movement (TRANSFERENCIA, PENDENTE, quantity negativo) + StockHistory vinculado
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

        // 2.1 Criar Movement de TRANSFERENCIA (PENDENTE, quantity negativo)
        const movement = await tx.movement.create({
          data: {
            productId: item.productId,
            type: MovementType.TRANSFERENCIA,
            quantity: -item.quantity, // 🔹 negativo (saída do Almoxarifado)
            reason: "Remessa de exemplo (seed)",
            status: MovementStatus.PENDENTE,
            fromSectorId: sectorId("Almoxarifado"),
            toSectorId: sectorId("Cozinha"),
            transferId: created.id,
            // 🔹 herda avgPriceInCents do produto no momento (regra do .md)
            unitPriceInCents: product.avgPriceInCents,
            createdById: staffAlmox.id,
          },
        });

        // 2.2 Debitar Product.quantity
        const newQuantity = product.quantity - item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: newQuantity },
        });

        // 2.3 StockHistory vinculado ao Movement (🔹 NOVO — antes não era criado)
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
    console.log(
      `      💡 Estoque debitado: Papel A4 -20, Caneta -50. Confirme/recuse via UI pra testar o fluxo.`,
    );
    console.log(
      `      📜 StockHistory criado e vinculado aos 2 Movements (auditoria consistente).`,
    );
  }

  // ============================================
  // 7. RESUMO
  // ============================================
  console.log("\n📊 ===== RESUMO =====");
  console.log(`🏢 Setores: ${sectorsData.length}`);
  console.log(`   - Almoxarifado (isWarehouse: true)`);
  console.log(`   - Cozinha (isWarehouse: false)`);
  console.log(`   - Escola (isWarehouse: false)`);
  console.log(`👤 Usuários:`);
  console.log(`   - MANAGER: admin@estoque.com / Admin@123 (Almoxarifado)`);
  console.log(`   - STAFF: almoxarife@estoque.com / Staff@123 (Almoxarifado)`);
  console.log(`   - STAFF: cozinha@estoque.com / Staff@123 (Cozinha)`);
  console.log(`   - STAFF: escola@estoque.com / Staff@123 (Escola)`);
  console.log(`📂 Categorias: ${categoryNames.length}`);
  console.log(`📦 Produtos criados: ${createdCount}`);
  console.log(`📦 Produtos existentes: ${products.length - createdCount}`);
  console.log(`📝 Pedido de exemplo: ${sampleRequest.id} (Cozinha, PENDENTE)`);
  console.log(
    `🚚 Remessa de exemplo: criada (Almoxarifado → Cozinha, PENDENTE)`,
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
