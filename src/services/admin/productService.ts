import {
  MovementStatus,
  MovementType,
  Role,
} from "../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import {
  CreateProductData,
  MovementData,
  MovementResponse,
  ProductFilters,
  ProductResponse,
  ProductsListResponse,
  StockSummary,
  UpdateProductData,
} from "../../types/product.types";
import {
  validateMovementData,
  validateProductData,
} from "../../utils/validation";
import { sectorService } from "./sectorService";

/**
 * 🔹 Recalcula a média ponderada móvel após uma ENTRADA com preço > 0.
 * Regra MYOB: entrada com preço null/0 NÃO recalcula (mantém a média).
 */
function calculateNewAverage(
  currentQuantity: number,
  currentAvg: number | null,
  incomingQuantity: number,
  incomingPrice: number,
): number {
  // Se não havia média (primeira entrada com preço), a média é o preço de entrada.
  if (currentAvg === null || currentQuantity <= 0) {
    return incomingPrice;
  }

  const totalCurrentValue = currentQuantity * currentAvg;
  const totalIncomingValue = incomingQuantity * incomingPrice;
  const newQuantity = currentQuantity + incomingQuantity;

  if (newQuantity <= 0) return incomingPrice;

  return Math.round((totalCurrentValue + totalIncomingValue) / newQuantity);
}

export const productService = {
  /**
   * Criar um novo produto.
   * - Gera SKU em transação (CategoryCounter)
   * - Aloca barcode em transação (ProductCounter)
   * - Preenche avgPriceInCents = priceInCents na criação
   * - Cria Movement de ENTRADA inicial (se quantity > 0)
   * - StockHistory inicial vinculado ao Movement
   */
  async createProduct(
    data: CreateProductData,
    userId: string,
  ): Promise<ProductResponse> {
    // 1. Normalizar nome
    const normalizedName = data.name.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      throw new Error("Dados inválidos: nome é obrigatório");
    }

    // 2. Validar dados (sem sku — backend gera)
    const validation = validateProductData({
      name: normalizedName,
      quantity: data.quantity,
      minStock: data.minStock,
      maxStock: data.maxStock,
    });
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    // 3. Verificar categoria (e pegar prefix)
    const category = await prisma.customCategory.findUnique({
      where: { id: data.categoryId },
      select: { id: true, prefix: true, name: true },
    });
    if (!category) {
      throw new Error("Categoria não encontrada");
    }

    const quantity = data.quantity ?? 0;
    const priceInCents = data.priceInCents ?? null;
    const supplier = data.supplier?.trim() || null;

    // 4. Transação atômica
    const product = await prisma.$transaction(async (tx) => {
      // 4.1 CategoryCounter (SKU)
      const categoryCounter = await tx.categoryCounter.update({
        where: { categoryId: category.id },
        data: { lastNumber: { increment: 1 } },
        select: { lastNumber: true },
      });
      const skuNumber = String(categoryCounter.lastNumber).padStart(3, "0");
      const sku = `${category.prefix}-${skuNumber}`;

      // 4.2 ProductCounter (barcode) — upsert protege contra tabela vazia
      const productCounter = await tx.productCounter.upsert({
        where: { id: "singleton" },
        update: { lastNumber: { increment: 1 } },
        create: { id: "singleton", lastNumber: 1000001 },
        select: { lastNumber: true },
      });
      const barcode = String(productCounter.lastNumber);

      // 4.3 Criar produto
      const created = await tx.product.create({
        data: {
          name: normalizedName,
          sku,
          barcode,
          description: data.description?.trim() || null,
          categoryId: category.id,
          imageUrl: data.imageUrl?.trim() || null,
          priceInCents,
          avgPriceInCents: priceInCents, // primeira entrada: média = preço
          quantity,
          minStock: data.minStock ?? 5,
          maxStock: data.maxStock ?? null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          batchNumber: data.batchNumber?.trim() || null,
          location: data.location?.trim() || null,
          supplier,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true, prefix: true } },
        },
      });

      // 4.4 Movement de ENTRADA inicial (se quantity > 0)
      let initialMovementId: string | undefined;
      if (created.quantity > 0) {
        const movement = await tx.movement.create({
          data: {
            productId: created.id,
            type: MovementType.ENTRADA,
            quantity: created.quantity,
            reason: "Entrada inicial (criação do produto)",
            status: MovementStatus.CONCLUIDO,
            unitPriceInCents: priceInCents,
            supplier,
            createdById: userId,
          },
        });
        initialMovementId = movement.id;
      }

      // 4.5 StockHistory inicial
      await tx.stockHistory.create({
        data: {
          productId: created.id,
          oldQuantity: 0,
          newQuantity: created.quantity,
          movementId: initialMovementId ?? null,
          changedById: userId,
          reason: "Criação do produto",
        },
      });

      return created;
    });

    // 5. Alertas (fora da transação — efeito colateral)
    await this.checkStockAlerts(
      product.id,
      product.quantity,
      product.minStock,
      product.expiryDate,
    );

    return product;
  },

  /**
   * Listar produtos com filtros
   */
  async listProducts(filters?: ProductFilters): Promise<ProductsListResponse> {
    const where: any = {};

    if (filters?.search) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE unaccent(name) ILIKE unaccent(${`%${filters.search}%`})
           OR unaccent(coalesce(sku, '')) ILIKE unaccent(${`%${filters.search}%`})
           OR unaccent(coalesce(description, '')) ILIKE unaccent(${`%${filters.search}%`})
      `;
      const searchIds = rows.map((r) => r.id);
      where.id = { in: searchIds.length > 0 ? searchIds : ["__none__"] };
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.minQuantity !== undefined) {
      where.quantity = { ...where.quantity, gte: filters.minQuantity };
    }
    if (filters?.maxQuantity !== undefined) {
      where.quantity = { ...where.quantity, lte: filters.maxQuantity };
    }

    if (filters?.hasExpiryDate === true) {
      where.expiryDate = { not: null };
    } else if (filters?.hasExpiryDate === false) {
      where.expiryDate = null;
    }

    if (filters?.isExpiring) {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.expiryDate = { gte: now, lte: thirtyDaysFromNow };
    }

    if (filters?.isExpired) {
      const now = new Date();
      where.expiryDate = { lt: now };
    }

    if (filters?.isLowStock) {
      where.AND = [
        { minStock: { not: null } },
        { quantity: { lte: prisma.product.fields.minStock } },
      ];
    }

    if (filters?.createdById) {
      where.createdById = filters.createdById;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = filters?.sortBy || "createdAt";
    const sortOrder = filters?.sortOrder || "desc";

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Buscar produto por ID
   */
  async getProductById(productId: string): Promise<ProductResponse | null> {
    return prisma.product.findUnique({
      where: { id: productId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        stockHistory: {
          orderBy: { changedAt: "desc" },
          take: 10,
          include: {
            changedBy: { select: { id: true, name: true, email: true } },
          },
        },
        stockAlerts: {
          where: { isResolved: false },
        },
      },
    });
  },

  /**
   * Buscar produto por SKU
   */
  async getProductBySku(sku: string): Promise<ProductResponse | null> {
    return prisma.product.findUnique({
      where: { sku },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  /**
   * Buscar produto por barcode (habilita bipagem)
   */
  async getProductByBarcode(barcode: string): Promise<ProductResponse | null> {
    return prisma.product.findUnique({
      where: { barcode },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true, prefix: true } },
      },
    });
  },

  /**
   * Preview do próximo barcode (NÃO aloca)
   */
  async getNextBarcode(): Promise<{ barcode: string }> {
    const counter = await prisma.productCounter.findUnique({
      where: { id: "singleton" },
      select: { lastNumber: true },
    });
    const next = (counter?.lastNumber ?? 1000000) + 1;
    return { barcode: String(next) };
  },

  /**
   * Atualizar produto (não mexe em sku nem avgPriceInCents)
   */
  async updateProduct(
    productId: string,
    data: UpdateProductData,
    userId: string,
  ): Promise<ProductResponse> {
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    if (!existingProduct) {
      throw new Error("Produto não encontrado");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isManager = user?.role === Role.MANAGER;
    const isCreator = existingProduct.createdById === userId;

    if (!isManager && !isCreator) {
      throw new Error(
        "Apenas o criador do produto ou um MANAGER podem atualizá-lo",
      );
    }

    if (data.name) {
      const validation = validateProductData({
        name: data.name,
        quantity: data.quantity,
        minStock: data.minStock,
        maxStock: data.maxStock,
      });
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
      }
    }

    if (data.categoryId !== undefined) {
      const categoryExists = await prisma.customCategory.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!categoryExists) {
        throw new Error("Categoria não encontrada");
      }
    }

    const updateData: any = {
      name: data.name?.trim().replace(/\s+/g, " "),
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      priceInCents: data.priceInCents, // undefined → removido; null → limpa
      categoryId: data.categoryId,
      minStock: data.minStock,
      maxStock: data.maxStock,
      expiryDate: data.expiryDate
        ? new Date(data.expiryDate)
        : data.expiryDate === null
          ? null
          : undefined,
      batchNumber: data.batchNumber?.trim() || null,
      location: data.location?.trim() || null,
      supplier: data.supplier?.trim() || null,
      updatedById: userId,
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    if (
      data.quantity !== undefined &&
      data.quantity !== existingProduct.quantity
    ) {
      updateData.quantity = data.quantity;

      await prisma.stockHistory.create({
        data: {
          productId,
          oldQuantity: existingProduct.quantity,
          newQuantity: data.quantity,
          changedById: userId,
          reason: data.reason || "Atualização manual de estoque",
        },
      });

      await this.checkStockAlerts(
        productId,
        data.quantity,
        data.minStock || existingProduct.minStock,
        data.expiryDate
          ? new Date(data.expiryDate)
          : existingProduct.expiryDate,
      );
    }

    return prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
      },
    });
  },

  /**
   * Deletar produto (limpa relacionamentos)
   */
  async deleteProduct(productId: string, userId: string): Promise<void> {
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        movements: { select: { id: true } },
        stockHistory: { select: { id: true } },
        stockAlerts: { select: { id: true } },
      },
    });

    if (!existingProduct) {
      throw new Error("Produto não encontrado");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isManager = user?.role === Role.MANAGER;
    const isCreator = existingProduct.createdById === userId;

    if (!isManager && !isCreator) {
      throw new Error(
        "Apenas o criador do produto ou um MANAGER podem deletá-lo",
      );
    }

    // Usamos uma transação para garantir consistência e segurança no banco
    await prisma.$transaction(async (tx) => {
      // 1. Remove ABSOLUTAMENTE TODO o histórico vinculado a este produto primeiro
      await tx.stockHistory.deleteMany({
        where: { productId },
      });

      // 2. Remove as movimentações e alertas
      await tx.movement.deleteMany({
        where: { productId },
      });

      await tx.stockAlert.deleteMany({
        where: { productId },
      });

      // 3. Agora o produto está 100% livre de chaves estrangeiras e pode ser apagado
      await tx.product.delete({
        where: { id: productId },
      });
    });
  },

  /**
   * Movimentar estoque (ENTRADA, SAIDA, AJUSTE)
   * - ENTRADA: grava unitPriceInCents/supplier, recalcula avgPriceInCents (se preço > 0),
   *   atualiza cache priceInCents/supplier no Product.
   * - SAIDA/AJUSTE: não mexe em preço/média.
   */
  async createMovement(
    data: MovementData,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<MovementResponse> {
    const validation = validateMovementData(data);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    // Fase 6: ENTRADA só STAFF do Almoxarifado ou MANAGER
    if (data.type === MovementType.ENTRADA) {
      const almoxarifadoId = await sectorService.getAlmoxarifadoId();
      const isManager = userRole === Role.MANAGER;
      const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

      if (!isManager && !isAlmoxarifadoStaff) {
        throw new Error(
          "Apenas STAFF do Almoxarifado ou MANAGER podem dar ENTRADA no estoque",
        );
      }
    }

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new Error("Produto não encontrado");
    }

    let newQuantity = product.quantity;
    let movementQuantity = data.quantity;

    if (data.type === MovementType.ENTRADA) {
      newQuantity += data.quantity;
    } else if (data.type === MovementType.SAIDA) {
      if (product.quantity < data.quantity) {
        throw new Error(
          `Estoque insuficiente. Disponível: ${product.quantity}, Solicitado: ${data.quantity}`,
        );
      }
      newQuantity -= data.quantity;
      movementQuantity = -data.quantity;
    } else if (data.type === MovementType.AJUSTE) {
      if (data.quantity < 0) {
        throw new Error("Quantidade para ajuste não pode ser negativa");
      }
      movementQuantity = data.quantity - product.quantity;
      newQuantity = data.quantity;
    }

    // Preparar campos de preço/fornecedor (só ENTRADA)
    const isEntrada = data.type === MovementType.ENTRADA;
    const unitPriceInCents = isEntrada ? (data.unitPriceInCents ?? null) : null;
    const supplier = isEntrada ? data.supplier?.trim() || null : null;

    // Criar movement
    const movement = await prisma.movement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: movementQuantity,
        reason: data.reason?.trim() || null,
        status: MovementStatus.CONCLUIDO,
        unitPriceInCents,
        supplier,
        createdById: userId,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, quantity: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Atualizar estoque + cache/média
    const productUpdate: any = { quantity: newQuantity };

    if (isEntrada) {
      // Preço/fornecedor só atualizam com preço > 0.
      // unitPriceInCents: 0 ou null = "sem preço de compra" (doação, brinde) — não sobrescreve cache.
      if (unitPriceInCents !== null && unitPriceInCents > 0) {
        productUpdate.priceInCents = unitPriceInCents;
        productUpdate.avgPriceInCents = calculateNewAverage(
          product.quantity,
          product.avgPriceInCents,
          data.quantity,
          unitPriceInCents,
        );
      }

      if (supplier !== null) {
        productUpdate.supplier = supplier;
      }
    }

    await prisma.product.update({
      where: { id: data.productId },
      data: productUpdate,
    });

    // Histórico
    await prisma.stockHistory.create({
      data: {
        productId: data.productId,
        oldQuantity: product.quantity,
        newQuantity,
        movementId: movement.id,
        changedById: userId,
        reason: data.reason || `Movimentação: ${data.type}`,
      },
    });

    // Alertas
    await this.checkStockAlerts(
      data.productId,
      newQuantity,
      product.minStock,
      product.expiryDate,
    );

    return movement;
  },

  /**
   * Verificar alertas de estoque (sem alterações)
   */
  async checkStockAlerts(
    productId: string,
    quantity: number,
    minStock: number | null,
    expiryDate: Date | null,
  ): Promise<void> {
    const alerts = [];

    if (quantity === 0) {
      alerts.push({
        productId,
        alertType: "OUT_OF_STOCK",
        message: `Produto com estoque zerado`,
      });
    } else if (minStock !== null && quantity <= minStock) {
      alerts.push({
        productId,
        alertType: "LOW_STOCK",
        message: `Produto com estoque baixo (${quantity} unidades). Mínimo: ${minStock}`,
      });
    }

    if (expiryDate) {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      if (expiryDate < now) {
        alerts.push({
          productId,
          alertType: "EXPIRED",
          message: `Produto vencido em ${expiryDate.toLocaleDateString()}`,
        });
      } else if (expiryDate <= thirtyDaysFromNow) {
        alerts.push({
          productId,
          alertType: "EXPIRING_SOON",
          message: `Produto vence em ${Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} dias`,
        });
      }
    }

    for (const alertData of alerts) {
      const existingAlert = await prisma.stockAlert.findFirst({
        where: {
          productId: alertData.productId,
          alertType: alertData.alertType,
          isResolved: false,
        },
      });
      if (!existingAlert) {
        await prisma.stockAlert.create({ data: alertData });
      }
    }

    if (minStock !== null && quantity > minStock && quantity > 0) {
      await prisma.stockAlert.updateMany({
        where: { productId, alertType: "LOW_STOCK", isResolved: false },
        data: { isResolved: true, resolvedAt: new Date() },
      });
    }

    if (quantity > 0) {
      await prisma.stockAlert.updateMany({
        where: { productId, alertType: "OUT_OF_STOCK", isResolved: false },
        data: { isResolved: true, resolvedAt: new Date() },
      });
    }

    if (expiryDate) {
      const now = new Date();
      if (expiryDate > now) {
        await prisma.stockAlert.updateMany({
          where: { productId, alertType: "EXPIRED", isResolved: false },
          data: { isResolved: true, resolvedAt: new Date() },
        });
      }

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      if (expiryDate > thirtyDaysFromNow) {
        await prisma.stockAlert.updateMany({
          where: {
            productId,
            alertType: "EXPIRING_SOON",
            isResolved: false,
          },
          data: { isResolved: true, resolvedAt: new Date() },
        });
      }
    }
  },

  /**
   * Resolver alerta de estoque
   */
  async resolveAlert(alertId: string, userId: string): Promise<void> {
    const alert = await prisma.stockAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) {
      throw new Error("Alerta não encontrado");
    }
    await prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });
  },

  /**
   * Resumo do estoque
   */
  async getStockSummary(userId?: string): Promise<StockSummary> {
    let where: any = {};
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role === Role.STAFF) {
        where.createdById = userId;
      }
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        minStock: true,
        expiryDate: true,
        category: { select: { id: true, name: true } },
      },
    });

    const totalProducts = products.length;
    const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
    const lowStockCount = products.filter(
      (p) => p.minStock !== null && p.quantity <= p.minStock,
    ).length;
    const outOfStockCount = products.filter((p) => p.quantity === 0).length;

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoonCount = products.filter(
      (p) =>
        p.expiryDate &&
        p.expiryDate <= thirtyDaysFromNow &&
        p.expiryDate >= now,
    ).length;

    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; count: number; items: number }
    >();

    for (const product of products) {
      const id = product.category.id;
      if (!categoryMap.has(id)) {
        categoryMap.set(id, {
          categoryId: id,
          categoryName: product.category.name,
          count: 0,
          items: 0,
        });
      }
      const cat = categoryMap.get(id)!;
      cat.count += 1;
      cat.items += product.quantity;
    }

    return {
      totalProducts,
      totalItems,
      lowStockCount,
      outOfStockCount,
      expiringSoonCount,
      categories: Array.from(categoryMap.values()),
    };
  },

  /**
   * Movimentações de um produto
   */
  async getProductMovements(
    productId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ movements: MovementResponse[]; total: number }> {
    const [movements, total] = await Promise.all([
      prisma.movement.findMany({
        where: { productId },
        include: {
          product: {
            select: { id: true, name: true, sku: true, quantity: true },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.movement.count({ where: { productId } }),
    ]);

    return { movements, total };
  },

  /**
   * Histórico de um produto
   */
  async getProductHistory(
    productId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ history: any[]; total: number }> {
    const [history, total] = await Promise.all([
      prisma.stockHistory.findMany({
        where: { productId },
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
          movement: {
            select: {
              id: true,
              type: true,
              quantity: true,
              unitPriceInCents: true,
              supplier: true,
            },
          },
        },
        orderBy: { changedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.stockHistory.count({ where: { productId } }),
    ]);

    return { history, total };
  },
};
