import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductCategory } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed no NeonDB...");

  await prisma.$connect();
  console.log("✅ Conectado ao NeonDB");

  // Criar usuário MANAGER padrão
  const managerEmail = "admin@estoque.com";
  let admin = await prisma.user.findUnique({
    where: { email: managerEmail },
  });

  if (!admin) {
    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    admin = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "Administrador",
        password: hashedPassword,
        role: "MANAGER",
        isActive: true,
      },
    });

    console.log("✅ Usuário MANAGER criado:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Senha: Admin@123`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}`);
  } else {
    console.log("ℹ️ Usuário MANAGER já existe");
    console.log(`   ID: ${admin.id}`);
  }

  console.log(`\n📦 Criando produtos para o admin: ${admin.id}`);

  // ✅ Usando os ENUMS corretamente
  const products = [
    {
      name: "Caneta Esferográfica Azul",
      sku: "CAN-001",
      category: ProductCategory.ESCRITORIO,
      quantity: 100,
      minStock: 20,
      // price: 1.5,
      // costPrice: 0.8,
      location: "Prateleira A1",
      supplier: "Fornecedor A",
      description: "Caneta esferográfica azul, ponta média",
    },
    {
      name: "Arroz Integral 1kg",
      sku: "ALI-001",
      category: ProductCategory.ALIMENTOS,
      quantity: 50,
      minStock: 10,
      // price: 8.9,
      // costPrice: 5.5,
      location: "Prateleira B2",
      supplier: "Distribuidora Alimentos",
      description: "Arroz integral tipo 1, pacote 1kg",
      expiryDate: new Date("2025-12-31"),
    },
    {
      name: "Parafuso 3x20mm",
      sku: "FER-001",
      category: ProductCategory.FERRAMENTAS,
      quantity: 500,
      minStock: 100,
      // price: 0.3,
      // costPrice: 0.15,
      location: "Gaveta C3",
      supplier: "Loja de Ferragens",
      description: "Parafuso para madeira 3x20mm, caixa com 1000 unidades",
    },
    {
      name: "Papel A4 75g",
      sku: "ESC-001",
      category: ProductCategory.ESCRITORIO,
      quantity: 200,
      minStock: 50,
      // price: 25.9,
      // costPrice: 18.0,
      location: "Prateleira D1",
      supplier: "Papelaria Central",
      description: "Papel A4 75g, pacote com 500 folhas",
    },
    {
      name: "Detergente Líquido 500ml",
      sku: "LIM-001",
      category: ProductCategory.LIMPEZA,
      quantity: 80,
      minStock: 15,
      // price: 4.5,
      // costPrice: 2.8,
      location: "Prateleira E2",
      supplier: "Distribuidora de Limpeza",
      description: "Detergente líquido neutro 500ml",
    },
    {
      name: "Chave de Fenda 6mm",
      sku: "FER-002",
      category: ProductCategory.FERRAMENTAS,
      quantity: 30,
      minStock: 10,
      // price: 12.9,
      // costPrice: 8.5,
      location: "Gaveta C1",
      supplier: "Loja de Ferragens",
      description: "Chave de fenda 6mm, cabo de plástico",
    },
    {
      name: 'Monitor 24" LED',
      sku: "EQU-001",
      category: ProductCategory.EQUIPAMENTOS,
      quantity: 5,
      minStock: 2,
      // price: 850.0,
      // costPrice: 620.0,
      location: "Sala de TI",
      supplier: "Distribuidora de Informática",
      description: "Monitor LED 24 polegadas, Full HD",
    },
    {
      name: "Caixa de Lápis de Cor 12 Cores",
      sku: "ESC-002",
      category: ProductCategory.ESCRITORIO,
      quantity: 60,
      minStock: 15,
      // price: 15.9,
      // costPrice: 9.8,
      location: "Prateleira A3",
      supplier: "Papelaria Central",
      description: "Caixa com 12 lápis de cor",
    },
    {
      name: "Água Sanitária 1L",
      sku: "LIM-002",
      category: ProductCategory.LIMPEZA,
      quantity: 40,
      minStock: 10,
      // price: 3.8,
      // costPrice: 2.1,
      location: "Prateleira E1",
      supplier: "Distribuidora de Limpeza",
      description: "Água sanitária 1L, hipoclorito de sódio 2,5%",
      expiryDate: new Date("2025-06-30"),
    },
    {
      name: "Parafuso 4x40mm",
      sku: "FER-003",
      category: ProductCategory.FERRAMENTAS,
      quantity: 800,
      minStock: 150,
      // price: 0.45,
      // costPrice: 0.25,
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
          category: productData.category, // ✅ Agora é o enum, não string
          quantity: productData.quantity,
          minStock: productData.minStock,
          // price: productData.price,
          // costPrice: productData.costPrice,
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

  console.log(`\n📊 Resumo:`);
  console.log(`   👤 Admin: ${admin.email} (ID: ${admin.id})`);
  console.log(`   📦 Produtos criados: ${createdCount}`);
  console.log(`   📦 Produtos existentes: ${products.length - createdCount}`);
  console.log("✅ Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("👋 Desconectado do NeonDB");
  });
