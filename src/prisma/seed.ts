// prisma/seed.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../generated/prisma/client.js";
import { auth } from "../lib/auth.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed no NeonDB...");

  await prisma.$connect();
  console.log("✅ Conectado ao NeonDB");

  // ============================================
  // 1. CRIAR CATEGORIAS BASE (UPSERT IDEMPOTENTE)
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

  const categoryMap = new Map<string, string>(); // name -> id

  for (const name of categoryNames) {
    const category = await prisma.customCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryMap.set(name, category.id);
    console.log(`   ✅ ${name} (id: ${category.id})`);
  }

  // Helper pra pegar id ou explodir com erro claro
  const catId = (name: string): string => {
    const id = categoryMap.get(name);
    if (!id) throw new Error(`Categoria não encontrada no map: ${name}`);
    return id;
  };

  // ============================================
  // 2. CRIAR USUÁRIO MANAGER USANDO BETTER AUTH
  // ============================================
  console.log("\n👤 Criando usuário MANAGER...");

  const managerEmail = "admin@estoque.com";
  let admin = await prisma.user.findUnique({
    where: { email: managerEmail },
  });

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

      admin = await prisma.user.findUnique({
        where: { email: managerEmail },
      });

      if (admin) {
        admin = await prisma.user.update({
          where: { id: admin.id },
          data: {
            role: Role.MANAGER,
            isActive: true,
          },
        });
      }

      console.log("✅ Usuário MANAGER criado:");
      console.log(`   Email: ${admin?.email}`);
      console.log(`   Senha: Admin@123`);
      console.log(`   Role: ${admin?.role}`);
      console.log(`   ID: ${admin?.id}`);
    } catch (error: any) {
      console.error("❌ Erro ao criar usuário via Better Auth:", error);
      throw error;
    }
  } else {
    console.log("ℹ️ Usuário MANAGER já existe");
    console.log(`   ID: ${admin.id}`);
  }

  // ============================================
  // 3. CRIAR USUÁRIO STAFF USANDO BETTER AUTH
  // ============================================
  console.log("\n👤 Criando usuário STAFF...");

  const staffEmail = "funcionario@estoque.com";
  let staff = await prisma.user.findUnique({
    where: { email: staffEmail },
  });

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

      staff = await prisma.user.findUnique({
        where: { email: staffEmail },
      });

      if (staff) {
        staff = await prisma.user.update({
          where: { id: staff.id },
          data: {
            role: Role.STAFF,
            isActive: true,
          },
        });
      }

      console.log("✅ Usuário STAFF criado:");
      console.log(`   Email: ${staff?.email}`);
      console.log(`   Senha: Staff@123`);
      console.log(`   Role: ${staff?.role}`);
      console.log(`   ID: ${staff?.id}`);
    } catch (error: any) {
      console.error("❌ Erro ao criar usuário STAFF via Better Auth:", error);
      throw error;
    }
  } else {
    console.log("ℹ️ Usuário STAFF já existe");
    console.log(`   ID: ${staff.id}`);
  }

  // ============================================
  // 4. BUSCAR O ADMIN ATUALIZADO
  // ============================================
  admin = await prisma.user.findUnique({
    where: { email: managerEmail },
  });

  if (!admin) {
    throw new Error("Admin não encontrado após criação!");
  }

  console.log(`\n📦 Criando produtos para o admin: ${admin.id}`);

  // ============================================
  // 5. CRIAR PRODUTOS (REFERENCIANDO categoryId)
  // ============================================
  const products = [
    {
      name: "Caneta Esferográfica Azul",
      sku: "CAN-001",
      categoryName: "Escritório", // 🔹 nome humanizado
      quantity: 100,
      minStock: 20,
      location: "Prateleira A1",
      supplier: "Fornecedor A",
      description: "Caneta esferográfica azul, ponta média",
    },
    {
      name: "Arroz Integral 1kg",
      sku: "ALI-001",
      categoryName: "Alimentos",
      quantity: 50,
      minStock: 10,
      location: "Prateleira B2",
      supplier: "Distribuidora Alimentos",
      description: "Arroz integral tipo 1, pacote 1kg",
      expiryDate: new Date("2025-12-31"),
    },
    {
      name: "Parafuso 3x20mm",
      sku: "FER-001",
      categoryName: "Ferramentas",
      quantity: 500,
      minStock: 100,
      location: "Gaveta C3",
      supplier: "Loja de Ferragens",
      description: "Parafuso para madeira 3x20mm, caixa com 1000 unidades",
    },
    {
      name: "Papel A4 75g",
      sku: "ESC-001",
      categoryName: "Escritório",
      quantity: 200,
      minStock: 50,
      location: "Prateleira D1",
      supplier: "Papelaria Central",
      description: "Papel A4 75g, pacote com 500 folhas",
    },
    {
      name: "Detergente Líquido 500ml",
      sku: "LIM-001",
      categoryName: "Limpeza",
      quantity: 80,
      minStock: 15,
      location: "Prateleira E2",
      supplier: "Distribuidora de Limpeza",
      description: "Detergente líquido neutro 500ml",
    },
    {
      name: "Chave de Fenda 6mm",
      sku: "FER-002",
      categoryName: "Ferramentas",
      quantity: 30,
      minStock: 10,
      location: "Gaveta C1",
      supplier: "Loja de Ferragens",
      description: "Chave de fenda 6mm, cabo de plástico",
    },
    {
      name: 'Monitor 24" LED',
      sku: "EQU-001",
      categoryName: "Equipamentos",
      quantity: 5,
      minStock: 2,
      location: "Sala de TI",
      supplier: "Distribuidora de Informática",
      description: "Monitor LED 24 polegadas, Full HD",
    },
    {
      name: "Caixa de Lápis de Cor 12 Cores",
      sku: "ESC-002",
      categoryName: "Escritório",
      quantity: 60,
      minStock: 15,
      location: "Prateleira A3",
      supplier: "Papelaria Central",
      description: "Caixa com 12 lápis de cor",
    },
    {
      name: "Água Sanitária 1L",
      sku: "LIM-002",
      categoryName: "Limpeza",
      quantity: 40,
      minStock: 10,
      location: "Prateleira E1",
      supplier: "Distribuidora de Limpeza",
      description: "Água sanitária 1L, hipoclorito de sódio 2,5%",
      expiryDate: new Date("2025-06-30"),
    },
    {
      name: "Parafuso 4x40mm",
      sku: "FER-003",
      categoryName: "Ferramentas",
      quantity: 800,
      minStock: 150,
      location: "Gaveta C4",
      supplier: "Loja de Ferragens",
      description: "Parafuso para madeira 4x40mm, caixa com 500 unidades",
    },
  ];

  let createdCount = 0;

  for (const productData of products) {
    const existing = await prisma.product.findUnique({
      where: { sku: productData.sku },
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          createdById: admin.id,
          name: productData.name,
          sku: productData.sku,
          categoryId: catId(productData.categoryName), // 🔹 FK
          quantity: productData.quantity,
          minStock: productData.minStock,
          location: productData.location,
          supplier: productData.supplier,
          description: productData.description,
          expiryDate: productData.expiryDate || null,
        },
      });
      createdCount++;
      console.log(
        `   ✅ Produto criado: ${productData.name} (SKU: ${productData.sku})`,
      );
    } else {
      console.log(
        `   ℹ️ Produto já existe: ${productData.name} (SKU: ${productData.sku})`,
      );
    }
  }

  // ============================================
  // 6. RESUMO FINAL
  // ============================================
  console.log("\n📊 ===== RESUMO ===== ");
  console.log(`📂 Categorias: ${categoryNames.length}`);
  console.log(`👤 Usuários:`);
  console.log(`   - MANAGER: admin@estoque.com / Admin@123`);
  console.log(`   - STAFF: funcionario@estoque.com / Staff@123`);
  console.log(`📦 Produtos criados: ${createdCount}`);
  console.log(`📦 Produtos existentes: ${products.length - createdCount}`);
  console.log("\n✅ Seed concluído com sucesso!");

  console.log("\n🔐 Teste a autenticação:");
  console.log(`   POST http://localhost:3000/api/auth/login`);
  console.log(`   { "email": "admin@estoque.com", "password": "Admin@123" }`);
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
