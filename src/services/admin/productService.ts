// src/services/admin/productService.ts
import {
  MovementStatus,
  MovementType,
  Role,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import {
  CreateProductData,
  UpdateProductData,
  ProductResponse,
  ProductsListResponse,
  ProductFilters,
  MovementData,
  MovementResponse,
  StockSummary,
} from "../../types/product.types.js";
import {
  validateProductData,
  validateMovementData,
  skuExists,
} from "../../utils/validation.js";

export const productService = {
  /**
   * Criar um novo produto (apenas MANAGER)
   */
  async createProduct(
    data: CreateProductData,
    userId: string,
  ): Promise<ProductResponse> {
    // 1. Validar dados
    const validation = validateProductData({
      name: data.name,
      sku: data.sku,
      category: data.category,
      quantity: data.quantity,
      minStock: data.minStock,
      maxStock: data.maxStock,
    });
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    // 2. Verificar se SKU já existe (se fornecido)
    if (data.sku) {
      const exists = await skuExists(prisma, data.sku);
      if (exists) {
        throw new Error(`SKU "${data.sku}" já está em uso`);
      }
    }

    // 3. Criar produto
    const product = await prisma.product.create({
      data: {
        name: data.name.trim(),
        sku: data.sku?.trim() || null,
        description: data.description?.trim() || null,
        category: data.category,
        quantity: data.quantity || 0,
        minStock: data.minStock || 5,
        maxStock: data.maxStock || null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        batchNumber: data.batchNumber?.trim() || null,
        location: data.location?.trim() || null,
        supplier: data.supplier?.trim() || null,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 4. Criar histórico inicial
    await prisma.stockHistory.create({
      data: {
        productId: product.id,
        oldQuantity: 0,
        newQuantity: product.quantity,
        changedById: userId,
        reason: "Criação do produto",
      },
    });

    // 5. Verificar alertas de estoque
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
  async listProducts(
    filters?: ProductFilters,
    userId?: string,
  ): Promise<ProductsListResponse> {
    // 1. Construir filtros
    const where: any = {};

    // Busca por nome ou SKU
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { sku: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Filtro por categoria
    if (filters?.category) {
      where.category = filters.category;
    }

    // Filtro por quantidade
    if (filters?.minQuantity !== undefined) {
      where.quantity = { ...where.quantity, gte: filters.minQuantity };
    }
    if (filters?.maxQuantity !== undefined) {
      where.quantity = { ...where.quantity, lte: filters.maxQuantity };
    }

    // Filtro por data de validade
    if (filters?.hasExpiryDate === true) {
      where.expiryDate = { not: null };
    } else if (filters?.hasExpiryDate === false) {
      where.expiryDate = null;
    }

    // Filtro para produtos vencendo nos próximos 30 dias
    if (filters?.isExpiring) {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.expiryDate = {
        gte: now,
        lte: thirtyDaysFromNow,
      };
    }

    // Filtro para estoque baixo
    if (filters?.isLowStock) {
      where.AND = [
        { minStock: { not: null } },
        { quantity: { lte: prisma.product.fields.minStock } },
      ];
    }

    // Filtro por criador
    if (filters?.createdById) {
      where.createdById = filters.createdById;
    }

    // Filtro por usuário (se for STAFF, só vê seus produtos)
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role === Role.STAFF) {
        where.createdById = userId;
      }
    }

    // 2. Paginação
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // 3. Ordenação
    const sortBy = filters?.sortBy || "createdAt";
    const sortOrder = filters?.sortOrder || "desc";

    // 4. Buscar produtos
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
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
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        stockHistory: {
          orderBy: { changedAt: "desc" },
          take: 10,
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        stockAlerts: {
          where: { isResolved: false },
        },
      },
    });

    return product;
  },

  /**
   * Buscar produto por SKU
   */
  async getProductBySku(sku: string): Promise<ProductResponse | null> {
    const product = await prisma.product.findUnique({
      where: { sku },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return product;
  },

  /**
   * Atualizar produto (apenas MANAGER)
   */
  async updateProduct(
    productId: string,
    data: UpdateProductData,
    userId: string,
  ): Promise<ProductResponse> {
    // 1. Verificar se o produto existe
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
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

    // 3. Validar dados
    if (data.name) {
      const validation = validateProductData({
        name: data.name,
        sku: data.sku,
        category: data.category,
        quantity: data.quantity,
        minStock: data.minStock,
        maxStock: data.maxStock,
      });
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
      }
    }

    // 4. Verificar se SKU já existe (se fornecido)
    if (data.sku) {
      const exists = await skuExists(prisma, data.sku, productId);
      if (exists) {
        throw new Error(`SKU "${data.sku}" já está em uso`);
      }
    }

    // 5. Preparar dados para atualização
    const updateData: any = {
      name: data.name?.trim(),
      sku: data.sku?.trim() || null,
      description: data.description?.trim() || null,
      category: data.category,
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

    // Remover campos undefined
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // 6. Se quantidade mudou, registrar histórico
    if (
      data.quantity !== undefined &&
      data.quantity !== existingProduct.quantity
    ) {
      updateData.quantity = data.quantity;

      // Criar histórico de alteração
      await prisma.stockHistory.create({
        data: {
          productId: productId,
          oldQuantity: existingProduct.quantity,
          newQuantity: data.quantity,
          changedById: userId,
          reason: data.reason || "Atualização manual de estoque",
        },
      });

      // Verificar alertas de estoque
      await this.checkStockAlerts(
        productId,
        data.quantity,
        data.minStock || existingProduct.minStock,
        data.expiryDate
          ? new Date(data.expiryDate)
          : existingProduct.expiryDate,
      );
    }

    // 7. Atualizar produto
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedProduct;
  },

  /**
   * Deletar produto (apenas MANAGER)
   */
  async deleteProduct(productId: string, userId: string): Promise<void> {
    // 1. Verificar se o produto existe
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        movements: {
          select: { id: true },
        },
        stockHistory: {
          select: { id: true },
        },
        stockAlerts: {
          select: { id: true },
        },
      },
    });

    if (!existingProduct) {
      throw new Error("Produto não encontrado");
    }

    // 2. Verificar se o usuário tem permissão (MANAGER ou criador)
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

    // 3. ✅ Deletar registros relacionados (na ordem correta)

    // 3.1 Primeiro, deletar os StockHistory (onde não tem movementId)
    await prisma.stockHistory.deleteMany({
      where: {
        productId: productId,
        movementId: null, // Só os que não têm movimento associado
      },
    });

    // 3.2 Depois, atualizar os StockHistory que têm movementId para remover a referência
    await prisma.stockHistory.updateMany({
      where: {
        productId: productId,
        movementId: { not: null },
      },
      data: {
        movementId: null, // Remove a referência ao movimento
      },
    });

    // 3.3 Deletar os Movimentos
    await prisma.movement.deleteMany({
      where: { productId: productId },
    });

    // 3.4 Deletar os StockAlerts
    await prisma.stockAlert.deleteMany({
      where: { productId: productId },
    });

    // 3.5 Agora deletar o produto (não tem mais restrições)
    await prisma.product.delete({
      where: { id: productId },
    });
  },

  /**
   * Movimentar estoque (ENTRADA, SAÍDA, AJUSTE)
   */
  async createMovement(
    data: MovementData,
    userId: string,
  ): Promise<MovementResponse> {
    // 1. Validar dados
    const validation = validateMovementData(data);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    // 2. Verificar se o produto existe
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new Error("Produto não encontrado");
    }

    // 3. Calcular nova quantidade
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
      // Para ajuste, quantity é a nova quantidade total
      if (data.quantity < 0) {
        throw new Error("Quantidade para ajuste não pode ser negativa");
      }
      movementQuantity = data.quantity - product.quantity;
      newQuantity = data.quantity;
    }

    // 4. Criar movimento
    const movement = await prisma.movement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: movementQuantity,
        reason: data.reason?.trim() || null,
        status: MovementStatus.CONCLUIDO,
        createdById: userId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 5. Atualizar estoque do produto
    await prisma.product.update({
      where: { id: data.productId },
      data: { quantity: newQuantity },
    });

    // 6. Criar histórico
    await prisma.stockHistory.create({
      data: {
        productId: data.productId,
        oldQuantity: product.quantity,
        newQuantity: newQuantity,
        movementId: movement.id,
        changedById: userId,
        reason: data.reason || `Movimentação: ${data.type}`,
      },
    });

    // 7. Verificar alertas de estoque
    await this.checkStockAlerts(
      data.productId,
      newQuantity,
      product.minStock,
      product.expiryDate,
    );

    return movement;
  },

  /**
   * Verificar alertas de estoque
   */
  async checkStockAlerts(
    productId: string,
    quantity: number,
    minStock: number | null,
    expiryDate: Date | null,
  ): Promise<void> {
    const alerts = [];

    // ✅ 1. Verificar se está em falta (OUT_OF_STOCK)
    if (quantity === 0) {
      alerts.push({
        productId,
        alertType: "OUT_OF_STOCK",
        message: `Produto com estoque zerado`,
      });
    }
    // ✅ 2. Verificar se está com estoque baixo (LOW_STOCK) - apenas se quantity > 0
    else if (minStock !== null && quantity <= minStock) {
      alerts.push({
        productId,
        alertType: "LOW_STOCK",
        message: `Produto com estoque baixo (${quantity} unidades). Mínimo: ${minStock}`,
      });
    }

    // ✅ 3. Verificar validade
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

    // Criar alertas
    for (const alertData of alerts) {
      const existingAlert = await prisma.stockAlert.findFirst({
        where: {
          productId: alertData.productId,
          alertType: alertData.alertType,
          isResolved: false,
        },
      });

      if (!existingAlert) {
        await prisma.stockAlert.create({
          data: alertData,
        });
      }
    }

    // ✅ 4. Resolver alertas que não são mais válidos

    // Resolver LOW_STOCK quando quantity > minStock (e quantity > 0)
    if (minStock !== null && quantity > minStock && quantity > 0) {
      await prisma.stockAlert.updateMany({
        where: {
          productId,
          alertType: "LOW_STOCK",
          isResolved: false,
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
        },
      });
    }

    // Resolver OUT_OF_STOCK quando quantity > 0
    if (quantity > 0) {
      await prisma.stockAlert.updateMany({
        where: {
          productId,
          alertType: "OUT_OF_STOCK",
          isResolved: false,
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
        },
      });
    }

    // Resolver alertas de validade
    if (expiryDate) {
      const now = new Date();
      if (expiryDate > now) {
        // Produto não está mais vencido
        await prisma.stockAlert.updateMany({
          where: {
            productId,
            alertType: "EXPIRED",
            isResolved: false,
          },
          data: {
            isResolved: true,
            resolvedAt: new Date(),
          },
        });
      }

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      if (expiryDate > thirtyDaysFromNow) {
        // Produto não está mais perto de vencer
        await prisma.stockAlert.updateMany({
          where: {
            productId,
            alertType: "EXPIRING_SOON",
            isResolved: false,
          },
          data: {
            isResolved: true,
            resolvedAt: new Date(),
          },
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
        resolvedBy: userId,
      },
    });
  },

  /**
   * Obter resumo do estoque
   */
  async getStockSummary(userId?: string): Promise<StockSummary> {
    // Verificar se é STAFF (só vê seus produtos)
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

    // Buscar todos os produtos
    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        minStock: true,
        expiryDate: true,
        category: true,
      },
    });

    // Calcular métricas
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

    // Agrupar por categoria
    const categoryMap = new Map();
    for (const product of products) {
      const key = product.category;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, { category: key, count: 0, items: 0 });
      }
      const cat = categoryMap.get(key);
      cat.count += 1;
      cat.items += product.quantity;
    }

    const categories = Array.from(categoryMap.values());

    return {
      totalProducts,
      totalItems,
      lowStockCount,
      outOfStockCount,
      expiringSoonCount,
      categories,
    };
  },

  /**
   * Buscar movimentações de um produto
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
            select: {
              id: true,
              name: true,
              sku: true,
              quantity: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
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
   * Buscar histórico de um produto
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
          changedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          movement: {
            select: {
              id: true,
              type: true,
              quantity: true,
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
