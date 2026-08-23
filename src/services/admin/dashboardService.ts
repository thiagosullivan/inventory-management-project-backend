// src/services/admin/dashboardService.ts
import { prisma } from "../../lib/prisma.js";
import {
  DashboardOverviewResponse,
  DashboardOverviewFilters,
  StockMetricsFilters,
  StockMetricsResponse,
  ActivityMetricsFilters,
  ActivityMetricsResponse,
  AlertsMetricsFilters,
  AlertsMetricsResponse,
} from "../../types/dashboard.types.js";
import { MovementType } from "../../generated/prisma/enums.js";

export const dashboardService = {
  /**
   * Get dashboard overview metrics
   */
  async getOverview(
    filters?: DashboardOverviewFilters,
  ): Promise<DashboardOverviewResponse> {
    const periodDays = filters?.periodDays || 30;
    const trendDays = filters?.trendDays || 7;

    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - trendDays);

    // Buscar todos os produtos
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        minStock: true,
        maxStock: true,
        expiryDate: true,
        category: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        updatedById: true,
      },
    });

    // Buscar movimentações do período
    const movements = await prisma.movement.findMany({
      where: {
        createdAt: {
          gte: periodStart,
          lte: now,
        },
      },
      select: {
        id: true,
        productId: true,
        type: true,
        quantity: true,
        reason: true,
        createdAt: true,
        createdById: true,
      },
    });

    // Buscar alertas ativos
    const activeAlerts = await prisma.stockAlert.findMany({
      where: {
        isResolved: false,
      },
      select: {
        id: true,
        alertType: true,
        productId: true,
      },
    });

    // Buscar movimentações para tendência (últimos 7 dias)
    const trendMovements = await prisma.movement.findMany({
      where: {
        createdAt: {
          gte: trendStart,
          lte: now,
        },
      },
      select: {
        type: true,
        quantity: true,
        createdAt: true,
      },
    });

    // ============================================================
    // 1. MÉTRICAS DE RESUMO (SUMMARY)
    // ============================================================

    const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);

    // ============================================================
    // 2. INDICADORES DE ALERTA (ALERTS)
    // ============================================================

    const lowStock = products.filter(
      (p) => p.minStock !== null && p.quantity <= p.minStock && p.quantity > 0,
    ).length;

    const outOfStock = products.filter((p) => p.quantity === 0).length;

    const expired = products.filter(
      (p) => p.expiryDate !== null && new Date(p.expiryDate) < now,
    ).length;

    const expiringSoon = products.filter((p) => {
      if (!p.expiryDate) return false;
      const expiryDate = new Date(p.expiryDate);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiryDate >= now && expiryDate <= thirtyDaysFromNow;
    }).length;

    const activeAlertsCount = activeAlerts.length;

    // ============================================================
    // 3. TAXAS E MÉDIAS (RATIOS)
    // ============================================================

    // Taxa de ocupação do estoque (média de quantity / maxStock)
    const productsWithMaxStock = products.filter(
      (p) => p.maxStock !== null && p.maxStock > 0,
    );
    let stockOccupancyRate = 0;
    if (productsWithMaxStock.length > 0) {
      const totalOccupancy = productsWithMaxStock.reduce((sum, p) => {
        const maxStock = p.maxStock!;
        const occupancy = Math.min((p.quantity / maxStock) * 100, 100);
        return sum + occupancy;
      }, 0);
      stockOccupancyRate = parseFloat(
        (totalOccupancy / productsWithMaxStock.length).toFixed(2),
      );
    }

    // Produtos ativos (com movimentação nos últimos 7 dias)
    const activeProductIds = new Set(movements.map((m) => m.productId));
    const activeProducts = activeProductIds.size;
    const activeProductsPercentage =
      products.length > 0
        ? parseFloat(((activeProducts / products.length) * 100).toFixed(2))
        : 0;

    // ============================================================
    // 4. RANKINGS E DISTRIBUIÇÕES (TOP ITEMS)
    // ============================================================

    // Top 5 produtos com menor quantidade (críticos)
    const lowestQuantityProducts = products
      .filter((p) => p.quantity >= 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
      }))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5);

    // Top 5 produtos com maior quantidade
    const highestQuantityProducts = products
      .filter((p) => p.quantity > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Distribuição por categoria
    const categoryMap = new Map<string, number>();
    products.forEach((p) => {
      const category = p.category || "OUTROS";
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });
    const categoryDistribution = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // ============================================================
    // 5. TENDÊNCIAS (TRENDS)
    // ============================================================

    // Movimentações diárias dos últimos 7 dias
    const dailyMap = new Map<string, { entries: number; exits: number }>();

    // Inicializar todos os dias do período
    for (let i = 0; i < trendDays; i++) {
      const date = new Date(trendStart);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      dailyMap.set(dateKey, { entries: 0, exits: 0 });
    }

    // Preencher com movimentações
    trendMovements.forEach((m) => {
      const dateKey = m.createdAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateKey);
      if (existing) {
        if (m.type === MovementType.ENTRADA) {
          existing.entries += Math.abs(m.quantity);
        } else if (m.type === MovementType.SAIDA) {
          existing.exits += Math.abs(m.quantity);
        } else if (m.type === MovementType.AJUSTE) {
          // Ajuste pode ser positivo ou negativo
          if (m.quantity > 0) {
            existing.entries += Math.abs(m.quantity);
          } else {
            existing.exits += Math.abs(m.quantity);
          }
        }
      }
    });

    const dailyMovements = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        entries: data.entries,
        exits: data.exits,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ============================================================
    // 6. MONTAR RESPOSTA
    // ============================================================

    return {
      summary: {
        totalProducts: products.length,
        totalUnits,
        totalMovements: movements.length,
        movementsPeriod: `last_${periodDays}_days`,
      },
      alerts: {
        lowStock,
        outOfStock,
        expired,
        expiringSoon,
        activeAlerts: activeAlertsCount,
      },
      ratios: {
        stockOccupancyRate,
        activeProducts,
        activeProductsPercentage,
      },
      topItems: {
        lowestQuantityProducts,
        highestQuantityProducts,
        categoryDistribution,
      },
      trends: {
        dailyMovements,
      },
    };
  },

  async getStockMetrics(
    filters?: StockMetricsFilters,
  ): Promise<StockMetricsResponse> {
    const limit = filters?.limit || 10;

    // Buscar todos os produtos com informações necessárias
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        minStock: true,
        maxStock: true,
        expiryDate: true,
        category: true,
        location: true,
        supplier: true,
        createdAt: true,
        updatedAt: true,
      },
      // Aplicar filtros se fornecidos
      where: {
        ...(filters?.category && { category: filters.category as any }),
        ...(filters?.location && {
          location: { contains: filters.location, mode: "insensitive" },
        }),
        ...(filters?.supplier && {
          supplier: { contains: filters.supplier, mode: "insensitive" },
        }),
      },
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // ============================================================
    // 1. RESUMO (SUMMARY)
    // ============================================================

    const totalProducts = products.length;
    const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
    const averageStockPerProduct =
      totalProducts > 0
        ? parseFloat((totalUnits / totalProducts).toFixed(2))
        : 0;
    const productsWithStock = products.filter((p) => p.quantity > 0).length;
    const productsWithoutStock = products.filter(
      (p) => p.quantity === 0,
    ).length;

    // ============================================================
    // 2. STATUS DO ESTOQUE (STOCK STATUS)
    // ============================================================

    let healthy = 0;
    let low = 0;
    let outOfStock = 0;
    let overStock = 0;
    let noMinStockDefined = 0;

    products.forEach((p) => {
      if (p.quantity === 0) {
        outOfStock++;
      } else if (p.minStock === null) {
        noMinStockDefined++;
        healthy++; // Considerar como saudável se não tem minStock definido
      } else if (p.quantity <= p.minStock) {
        low++;
      } else if (p.maxStock !== null && p.quantity >= p.maxStock) {
        overStock++;
      } else {
        healthy++;
      }
    });

    // ============================================================
    // 3. STATUS DE VALIDADE (EXPIRY STATUS)
    // ============================================================

    let expired = 0;
    let expiringSoon = 0;
    let valid = 0;
    let noExpiryDate = 0;

    products.forEach((p) => {
      if (!p.expiryDate) {
        noExpiryDate++;
        return;
      }

      const expiryDate = new Date(p.expiryDate);
      if (expiryDate < now) {
        expired++;
      } else if (expiryDate <= thirtyDaysFromNow) {
        expiringSoon++;
      } else {
        valid++;
      }
    });

    // ============================================================
    // 4. DISTRIBUIÇÃO (DISTRIBUTION)
    // ============================================================

    // Por categoria
    const categoryMap = new Map<string, { count: number; units: number }>();
    products.forEach((p) => {
      const category = p.category || "OUTROS";
      const existing = categoryMap.get(category);
      if (existing) {
        existing.count++;
        existing.units += p.quantity;
      } else {
        categoryMap.set(category, { count: 1, units: p.quantity });
      }
    });
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        totalUnits: data.units,
      }))
      .sort((a, b) => b.count - a.count);

    // Por localização
    const locationMap = new Map<string, { count: number; units: number }>();
    products.forEach((p) => {
      const location = p.location || "Não definido";
      const existing = locationMap.get(location);
      if (existing) {
        existing.count++;
        existing.units += p.quantity;
      } else {
        locationMap.set(location, { count: 1, units: p.quantity });
      }
    });
    const byLocation = Array.from(locationMap.entries())
      .map(([location, data]) => ({
        location,
        count: data.count,
        totalUnits: data.units,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 localizações

    // Por fornecedor
    const supplierMap = new Map<string, { count: number; units: number }>();
    products.forEach((p) => {
      const supplier = p.supplier || "Não definido";
      const existing = supplierMap.get(supplier);
      if (existing) {
        existing.count++;
        existing.units += p.quantity;
      } else {
        supplierMap.set(supplier, { count: 1, units: p.quantity });
      }
    });
    const bySupplier = Array.from(supplierMap.entries())
      .map(([supplier, data]) => ({
        supplier,
        count: data.count,
        totalUnits: data.units,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 fornecedores

    // ============================================================
    // 5. DETALHES (DETAILS) - Listas com limit
    // ============================================================

    // Produtos com estoque baixo
    const productsWithLowStock = products
      .filter(
        (p) =>
          p.minStock !== null && p.quantity <= p.minStock && p.quantity > 0,
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        minStock: p.minStock,
        location: p.location,
        supplier: p.supplier,
        expiryDate: p.expiryDate,
      }))
      .sort(
        (a, b) =>
          a.quantity / (a.minStock || 1) - b.quantity / (b.minStock || 1),
      )
      .slice(0, limit);

    // Produtos vencendo em breve
    const productsExpiringSoon = products
      .filter((p) => {
        if (!p.expiryDate) return false;
        const expiryDate = new Date(p.expiryDate);
        return expiryDate >= now && expiryDate <= thirtyDaysFromNow;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        expiryDate: p.expiryDate!,
        location: p.location,
        supplier: p.supplier,
      }))
      .sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
      )
      .slice(0, limit);

    // Produtos em falta (out of stock)
    const productsOutOfStock = products
      .filter((p) => p.quantity === 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        location: p.location,
        supplier: p.supplier,
      }))
      .slice(0, limit);

    // ============================================================
    // 6. MONTAR RESPOSTA
    // ============================================================

    return {
      summary: {
        totalProducts,
        totalUnits,
        averageStockPerProduct,
        productsWithStock,
        productsWithoutStock,
      },
      stockStatus: {
        healthy,
        low,
        outOfStock,
        overStock,
        noMinStockDefined,
      },
      expiryStatus: {
        expired,
        expiringSoon,
        valid,
        noExpiryDate,
      },
      distribution: {
        byCategory,
        byLocation,
        bySupplier,
      },
      details: {
        productsWithLowStock,
        productsExpiringSoon,
        productsOutOfStock,
      },
    };
  },

  /**
   * Get activity metrics (movements and users)
   * GET /dashboard/activity
   */
  async getActivityMetrics(
    filters?: ActivityMetricsFilters,
  ): Promise<ActivityMetricsResponse> {
    const periodDays = filters?.periodDays || 30;
    const limit = filters?.limit || 10;

    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    // ============================================================
    // CONSTRUIR FILTROS
    // ============================================================

    const movementWhere: any = {
      createdAt: {
        gte: periodStart,
        lte: now,
      },
    };

    if (filters?.userId) {
      movementWhere.createdById = filters.userId;
    }

    if (filters?.productId) {
      movementWhere.productId = filters.productId;
    }

    if (filters?.type) {
      movementWhere.type = filters.type;
    }

    // ============================================================
    // 1. BUSCAR MOVIMENTAÇÕES DO PERÍODO
    // ============================================================

    const movements = await prisma.movement.findMany({
      where: movementWhere,
      select: {
        id: true,
        productId: true,
        type: true,
        quantity: true,
        reason: true,
        createdAt: true,
        createdById: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Buscar todos os usuários para estatísticas
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLogin: true,
      },
    });

    // Buscar todos os produtos para estatísticas de produtos parados
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        updatedAt: true,
      },
    });

    // ============================================================
    // 2. RESUMO (SUMMARY)
    // ============================================================

    const totalMovements = movements.length;
    const totalEntries = movements
      .filter((m) => m.type === "ENTRADA")
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const totalExits = movements
      .filter((m) => m.type === "SAIDA")
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const totalAdjustments = movements
      .filter((m) => m.type === "AJUSTE")
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

    const entriesExitsRatio =
      totalExits > 0
        ? parseFloat((totalEntries / totalExits).toFixed(2))
        : totalEntries > 0
          ? totalEntries
          : 0;

    const averageMovementsPerDay =
      periodDays > 0 ? parseFloat((totalMovements / periodDays).toFixed(2)) : 0;

    // ============================================================
    // 3. POR PERÍODO (BY PERIOD)
    // ============================================================

    // 3.1 Diário
    const dailyMap = new Map<
      string,
      { entries: number; exits: number; adjustments: number }
    >();

    for (let i = 0; i < periodDays; i++) {
      const date = new Date(periodStart);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      dailyMap.set(dateKey, { entries: 0, exits: 0, adjustments: 0 });
    }

    movements.forEach((m) => {
      const dateKey = m.createdAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateKey);
      if (existing) {
        const quantity = Math.abs(m.quantity);
        if (m.type === "ENTRADA") {
          existing.entries += quantity;
        } else if (m.type === "SAIDA") {
          existing.exits += quantity;
        } else if (m.type === "AJUSTE") {
          existing.adjustments += quantity;
        }
      }
    });

    const daily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        entries: data.entries,
        exits: data.exits,
        adjustments: data.adjustments,
        total: data.entries + data.exits + data.adjustments,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 3.2 Semanal
    const weeklyMap = new Map<
      string,
      { entries: number; exits: number; adjustments: number }
    >();

    movements.forEach((m) => {
      const date = new Date(m.createdAt);
      const weekNumber = getWeekNumber(date);
      const year = date.getFullYear();
      const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;

      const existing = weeklyMap.get(weekKey);
      if (existing) {
        const quantity = Math.abs(m.quantity);
        if (m.type === "ENTRADA") {
          existing.entries += quantity;
        } else if (m.type === "SAIDA") {
          existing.exits += quantity;
        } else if (m.type === "AJUSTE") {
          existing.adjustments += quantity;
        }
      } else {
        const quantity = Math.abs(m.quantity);
        weeklyMap.set(weekKey, {
          entries: m.type === "ENTRADA" ? quantity : 0,
          exits: m.type === "SAIDA" ? quantity : 0,
          adjustments: m.type === "AJUSTE" ? quantity : 0,
        });
      }
    });

    const weekly = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        week,
        entries: data.entries,
        exits: data.exits,
        adjustments: data.adjustments,
        total: data.entries + data.exits + data.adjustments,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // 3.3 Mensal
    const monthlyMap = new Map<
      string,
      { entries: number; exits: number; adjustments: number }
    >();

    movements.forEach((m) => {
      const date = new Date(m.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const existing = monthlyMap.get(monthKey);
      if (existing) {
        const quantity = Math.abs(m.quantity);
        if (m.type === "ENTRADA") {
          existing.entries += quantity;
        } else if (m.type === "SAIDA") {
          existing.exits += quantity;
        } else if (m.type === "AJUSTE") {
          existing.adjustments += quantity;
        }
      } else {
        const quantity = Math.abs(m.quantity);
        monthlyMap.set(monthKey, {
          entries: m.type === "ENTRADA" ? quantity : 0,
          exits: m.type === "SAIDA" ? quantity : 0,
          adjustments: m.type === "AJUSTE" ? quantity : 0,
        });
      }
    });

    const monthly = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        entries: data.entries,
        exits: data.exits,
        adjustments: data.adjustments,
        total: data.entries + data.exits + data.adjustments,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ============================================================
    // 4. POR USUÁRIO (BY USER)
    // ============================================================

    const userMovementMap = new Map<
      string,
      {
        userId: string;
        name: string | null;
        email: string;
        role: string;
        totalMovements: number;
        entries: number;
        exits: number;
        adjustments: number;
        lastActivity: Date | null;
      }
    >();

    // Inicializar com todos os usuários
    users.forEach((u) => {
      userMovementMap.set(u.id, {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        totalMovements: 0,
        entries: 0,
        exits: 0,
        adjustments: 0,
        lastActivity: null,
      });
    });

    // Preencher com movimentações
    movements.forEach((m) => {
      const userData = userMovementMap.get(m.createdById);
      if (userData) {
        const quantity = Math.abs(m.quantity);
        userData.totalMovements += 1;

        if (m.type === "ENTRADA") {
          userData.entries += quantity;
        } else if (m.type === "SAIDA") {
          userData.exits += quantity;
        } else if (m.type === "AJUSTE") {
          userData.adjustments += quantity;
        }

        if (!userData.lastActivity || m.createdAt > userData.lastActivity) {
          userData.lastActivity = m.createdAt;
        }
      }
    });

    // Usuários ativos (que fizeram pelo menos uma movimentação)
    const activeUserData = Array.from(userMovementMap.values()).filter(
      (u) => u.totalMovements > 0,
    );

    const topUsers = activeUserData
      .sort((a, b) => b.totalMovements - a.totalMovements)
      .slice(0, limit)
      .map((u) => ({
        ...u,
        lastActivity: u.lastActivity,
      }));

    const totalUsers = users.length;
    const activeUsers = activeUserData.length;
    const averageMovementsPerUser =
      activeUsers > 0
        ? parseFloat((totalMovements / activeUsers).toFixed(2))
        : 0;

    const mostActiveUser =
      activeUserData.length > 0
        ? activeUserData[0].name || activeUserData[0].email
        : null;
    const mostActiveUserCount =
      activeUserData.length > 0 ? activeUserData[0].totalMovements : 0;

    // ============================================================
    // 5. POR PRODUTO (BY PRODUCT)
    // ============================================================

    const productMovementMap = new Map<
      string,
      {
        productId: string;
        name: string;
        sku: string | null;
        totalMovements: number;
        entries: number;
        exits: number;
        currentQuantity: number;
        lastMovement: Date | null;
      }
    >();

    // Inicializar com todos os produtos
    products.forEach((p) => {
      productMovementMap.set(p.id, {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        totalMovements: 0,
        entries: 0,
        exits: 0,
        currentQuantity: p.quantity,
        lastMovement: null,
      });
    });

    // Preencher com movimentações
    movements.forEach((m) => {
      const productData = productMovementMap.get(m.productId);
      if (productData) {
        const quantity = Math.abs(m.quantity);
        productData.totalMovements += 1;

        if (m.type === "ENTRADA") {
          productData.entries += quantity;
        } else if (m.type === "SAIDA") {
          productData.exits += quantity;
        }

        if (
          !productData.lastMovement ||
          m.createdAt > productData.lastMovement
        ) {
          productData.lastMovement = m.createdAt;
        }
      }
    });

    const productDataArray = Array.from(productMovementMap.values());

    // Produtos mais movimentados
    const mostMovedProducts = productDataArray
      .filter((p) => p.totalMovements > 0)
      .sort((a, b) => b.totalMovements - a.totalMovements)
      .slice(0, limit)
      .map((p) => ({
        productId: p.productId,
        name: p.name,
        sku: p.sku,
        totalMovements: p.totalMovements,
        entries: p.entries,
        exits: p.exits,
        currentQuantity: p.currentQuantity,
      }));

    // Produtos menos movimentados (parados)
    const leastMovedProducts = productDataArray
      .filter((p) => p.totalMovements === 0)
      .map((p) => {
        const daysWithoutMovement = Math.floor(
          (now.getTime() -
            new Date(
              p.lastMovement || p.currentQuantity > 0
                ? p.lastMovement || now
                : now,
            ).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return {
          productId: p.productId,
          name: p.name,
          sku: p.sku,
          totalMovements: 0,
          currentQuantity: p.currentQuantity,
          daysWithoutMovement: daysWithoutMovement || 0,
        };
      })
      .sort((a, b) => b.daysWithoutMovement - a.daysWithoutMovement)
      .slice(0, limit);

    // ============================================================
    // 6. POR MOTIVO (BY REASON)
    // ============================================================

    const reasonMap = new Map<string, number>();
    movements.forEach((m) => {
      const reason = m.reason || "Sem motivo";
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    });

    const byReason = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage:
          totalMovements > 0
            ? parseFloat(((count / totalMovements) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ============================================================
    // 7. TENDÊNCIAS (TRENDS)
    // ============================================================

    // 7.1 Distribuição por hora do dia
    const hourlyMap = new Map<number, { entries: number; exits: number }>();
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, { entries: 0, exits: 0 });
    }

    movements.forEach((m) => {
      const hour = m.createdAt.getHours();
      const existing = hourlyMap.get(hour);
      if (existing) {
        const quantity = Math.abs(m.quantity);
        if (m.type === "ENTRADA") {
          existing.entries += quantity;
        } else if (m.type === "SAIDA") {
          existing.exits += quantity;
        }
      }
    });

    const hourlyDistribution = Array.from(hourlyMap.entries()).map(
      ([hour, data]) => ({
        hour,
        entries: data.entries,
        exits: data.exits,
        total: data.entries + data.exits,
      }),
    );

    // 7.2 Distribuição por dia da semana
    const weekdayMap = new Map<number, { entries: number; exits: number }>();
    const weekdays = [
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ];
    for (let i = 0; i < 7; i++) {
      weekdayMap.set(i, { entries: 0, exits: 0 });
    }

    movements.forEach((m) => {
      const dayOfWeek = m.createdAt.getDay();
      const existing = weekdayMap.get(dayOfWeek);
      if (existing) {
        const quantity = Math.abs(m.quantity);
        if (m.type === "ENTRADA") {
          existing.entries += quantity;
        } else if (m.type === "SAIDA") {
          existing.exits += quantity;
        }
      }
    });

    const weekdayDistribution = Array.from(weekdayMap.entries()).map(
      ([dayOfWeek, data]) => ({
        day: weekdays[dayOfWeek],
        dayOfWeek,
        entries: data.entries,
        exits: data.exits,
        total: data.entries + data.exits,
      }),
    );

    // 7.3 Sazonalidade mensal
    const monthlySeasonalityMap = new Map<
      number,
      { entries: number; exits: number }
    >();
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    for (let i = 0; i < 12; i++) {
      monthlySeasonalityMap.set(i, { entries: 0, exits: 0 });
    }

    movements.forEach((m) => {
      const month = m.createdAt.getMonth();
      const existing = monthlySeasonalityMap.get(month);
      if (existing) {
        const quantity = Math.abs(m.quantity);
        if (m.type === "ENTRADA") {
          existing.entries += quantity;
        } else if (m.type === "SAIDA") {
          existing.exits += quantity;
        }
      }
    });

    const monthlySeasonality = Array.from(monthlySeasonalityMap.entries()).map(
      ([monthNumber, data]) => ({
        month: monthNames[monthNumber],
        monthNumber,
        entries: data.entries,
        exits: data.exits,
        total: data.entries + data.exits,
      }),
    );

    // ============================================================
    // 8. MONTAR RESPOSTA
    // ============================================================

    return {
      summary: {
        totalMovements,
        totalEntries,
        totalExits,
        totalAdjustments,
        entriesExitsRatio,
        averageMovementsPerDay,
        periodDays,
      },
      byPeriod: {
        daily,
        weekly,
        monthly,
      },
      byUser: {
        topUsers,
        summary: {
          activeUsers,
          totalUsers,
          averageMovementsPerUser,
          mostActiveUser,
          mostActiveUserCount,
        },
      },
      byProduct: {
        mostMovedProducts,
        leastMovedProducts,
      },
      byReason,
      trends: {
        hourlyDistribution,
        weekdayDistribution,
        monthlySeasonality,
      },
    };
  },

  /**
   * Get alerts metrics
   * GET /dashboard/alerts
   */
  async getAlertsMetrics(
    filters?: AlertsMetricsFilters,
  ): Promise<AlertsMetricsResponse> {
    const limit = filters?.limit || 10;

    // ============================================================
    // CONSTRUIR FILTROS
    // ============================================================

    const where: any = {};

    if (filters?.alertType) {
      where.alertType = filters.alertType;
    }

    if (filters?.isResolved !== undefined) {
      where.isResolved = filters.isResolved;
    }

    if (filters?.productId) {
      where.productId = filters.productId;
    }

    // ============================================================
    // 1. BUSCAR TODOS OS ALERTAS
    // ============================================================

    const alerts = await prisma.stockAlert.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            minStock: true,
            expiryDate: true,
            location: true,
            supplier: true,
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Buscar produtos para análise por categoria
    const products = await prisma.product.findMany({
      select: {
        id: true,
        category: true,
      },
    });

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ============================================================
    // 2. RESUMO (SUMMARY)
    // ============================================================

    const totalAlerts = alerts.length;
    const resolvedAlerts = alerts.filter((a) => a.isResolved).length;
    const activeAlerts = alerts.filter((a) => !a.isResolved).length;
    const resolutionRate =
      totalAlerts > 0
        ? parseFloat(((resolvedAlerts / totalAlerts) * 100).toFixed(2))
        : 0;

    // Calcular tempo médio de resolução (em horas)
    let totalResolutionTime = 0;
    let resolvedWithTime = 0;
    alerts.forEach((a) => {
      if (a.isResolved && a.resolvedAt) {
        const diffInHours =
          (a.resolvedAt.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60);
        totalResolutionTime += diffInHours;
        resolvedWithTime++;
      }
    });
    const averageResolutionTimeHours =
      resolvedWithTime > 0
        ? parseFloat((totalResolutionTime / resolvedWithTime).toFixed(2))
        : 0;

    // Alertas por tipo
    const typeMap = new Map<string, number>();
    alerts.forEach((a) => {
      let type = a.alertType;
      // Se for LOW_STOCK com quantity === 0, considerar como OUT_OF_STOCK
      if (type === "LOW_STOCK" && a.product.quantity === 0) {
        type = "OUT_OF_STOCK";
      }
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const alertsByType = Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage:
          totalAlerts > 0
            ? parseFloat(((count / totalAlerts) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ============================================================
    // 3. ALERTAS ATIVOS (ACTIVE ALERTS)
    // ============================================================

    const activeAlertsList = alerts.filter((a) => !a.isResolved);

    // 3.1 Low Stock (apenas produtos com quantity > 0 e quantity <= minStock)
    const lowStockAlerts = activeAlertsList
      .filter((a) => a.alertType === "LOW_STOCK" && a.product.quantity > 0)
      .map((a) => ({
        id: a.product.id,
        name: a.product.name,
        sku: a.product.sku,
        quantity: a.product.quantity,
        minStock: a.product.minStock || 0,
        location: a.product.location,
        supplier: a.product.supplier,
        createdAt: a.createdAt,
      }));

    // 3.2 Out of Stock (produtos com quantity === 0)
    // Inclui alertas do tipo OUT_OF_STOCK e também LOW_STOCK com quantity === 0
    const outOfStockAlerts = activeAlertsList
      .filter(
        (a) =>
          a.alertType === "OUT_OF_STOCK" ||
          (a.alertType === "LOW_STOCK" && a.product.quantity === 0),
      )
      .map((a) => ({
        id: a.product.id,
        name: a.product.name,
        sku: a.product.sku,
        quantity: a.product.quantity,
        minStock: a.product.minStock || 0,
        location: a.product.location,
        supplier: a.product.supplier,
        createdAt: a.createdAt,
      }));

    // 3.3 Expiring Soon
    const expiringSoonAlerts = activeAlertsList
      .filter((a) => a.alertType === "EXPIRING_SOON")
      .map((a) => ({
        id: a.product.id,
        name: a.product.name,
        sku: a.product.sku,
        quantity: a.product.quantity,
        expiryDate: a.product.expiryDate || new Date(),
        location: a.product.location,
        supplier: a.product.supplier,
        createdAt: a.createdAt,
      }));

    // 3.4 Expired
    const expiredAlerts = activeAlertsList
      .filter((a) => a.alertType === "EXPIRED")
      .map((a) => ({
        id: a.product.id,
        name: a.product.name,
        sku: a.product.sku,
        quantity: a.product.quantity,
        expiryDate: a.product.expiryDate || new Date(),
        location: a.product.location,
        supplier: a.product.supplier,
        createdAt: a.createdAt,
      }));

    // ============================================================
    // 4. HISTÓRICO (HISTORY)
    // ============================================================

    const resolvedLast7Days = alerts.filter(
      (a) => a.isResolved && a.resolvedAt && a.resolvedAt >= sevenDaysAgo,
    ).length;

    const resolvedLast30Days = alerts.filter(
      (a) => a.isResolved && a.resolvedAt && a.resolvedAt >= thirtyDaysAgo,
    ).length;

    // Tendência de resolução (últimos 7 dias)
    const trendMap = new Map<string, { resolved: number; created: number }>();
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      trendMap.set(dateKey, { resolved: 0, created: 0 });
    }

    alerts.forEach((a) => {
      const createdKey = a.createdAt.toISOString().split("T")[0];
      const created = trendMap.get(createdKey);
      if (created) {
        created.created++;
      }

      if (a.isResolved && a.resolvedAt) {
        const resolvedKey = a.resolvedAt.toISOString().split("T")[0];
        const resolved = trendMap.get(resolvedKey);
        if (resolved) {
          resolved.resolved++;
        }
      }
    });

    const resolutionTrend = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        resolved: data.resolved,
        created: data.created,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top produtos com mais alertas
    const productAlertMap = new Map<
      string,
      {
        total: number;
        resolved: number;
        active: number;
        name: string;
        sku: string | null;
      }
    >();

    alerts.forEach((a) => {
      const existing = productAlertMap.get(a.productId);
      if (existing) {
        existing.total++;
        if (a.isResolved) {
          existing.resolved++;
        } else {
          existing.active++;
        }
      } else {
        productAlertMap.set(a.productId, {
          total: 1,
          resolved: a.isResolved ? 1 : 0,
          active: a.isResolved ? 0 : 1,
          name: a.product.name,
          sku: a.product.sku,
        });
      }
    });

    const topProductsWithAlerts = Array.from(productAlertMap.entries())
      .map(([productId, data]) => ({
        productId,
        name: data.name,
        sku: data.sku,
        totalAlerts: data.total,
        resolvedAlerts: data.resolved,
        activeAlerts: data.active,
      }))
      .sort((a, b) => b.totalAlerts - a.totalAlerts)
      .slice(0, limit);

    // ============================================================
    // 5. POR CATEGORIA (BY CATEGORY)
    // ============================================================

    const categoryAlertMap = new Map<
      string,
      { lowStock: number; expiringSoon: number; expired: number }
    >();

    // Inicializar com todas as categorias
    const allCategories = new Set(products.map((p) => p.category || "OUTROS"));
    allCategories.forEach((cat) => {
      categoryAlertMap.set(cat, { lowStock: 0, expiringSoon: 0, expired: 0 });
    });

    alerts.forEach((a) => {
      const category = a.product.category || "OUTROS";
      const existing = categoryAlertMap.get(category);
      if (existing) {
        if (a.alertType === "LOW_STOCK") {
          existing.lowStock++;
        } else if (a.alertType === "EXPIRING_SOON") {
          existing.expiringSoon++;
        } else if (a.alertType === "EXPIRED") {
          existing.expired++;
        }
      }
    });

    const byCategory = Array.from(categoryAlertMap.entries())
      .map(([category, data]) => ({
        category,
        alertCount: data.lowStock + data.expiringSoon + data.expired,
        lowStock: data.lowStock,
        expiringSoon: data.expiringSoon,
        expired: data.expired,
      }))
      .filter((c) => c.alertCount > 0)
      .sort((a, b) => b.alertCount - a.alertCount);

    // ============================================================
    // 6. DETALHES (DETAILS) - Alertas Recentes
    // ============================================================

    // Buscar todos os IDs de usuários que resolveram alertas
    const resolvedByUserIds = alerts
      .filter((a) => a.resolvedBy)
      .map((a) => a.resolvedBy as string)
      .filter((id): id is string => id !== null && id !== undefined);

    // Buscar informações dos usuários que resolveram alertas
    const resolvedByUsers = await prisma.user.findMany({
      where: {
        id: { in: resolvedByUserIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Criar um mapa para lookup rápido
    const userMap = new Map(resolvedByUsers.map((u) => [u.id, u]));

    const recentAlerts = alerts.slice(0, limit).map((a) => {
      const user = a.resolvedBy ? userMap.get(a.resolvedBy) : null;

      return {
        id: a.id,
        productId: a.productId,
        productName: a.product.name,
        productSku: a.product.sku,
        alertType: a.alertType,
        message: a.message,
        isResolved: a.isResolved,
        createdAt: a.createdAt,
        resolvedAt: a.resolvedAt || null,
        resolvedBy: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
            }
          : null,
      };
    });

    // ============================================================
    // 7. MONTAR RESPOSTA
    // ============================================================

    return {
      summary: {
        totalAlerts,
        resolvedAlerts,
        activeAlerts,
        resolutionRate,
        averageResolutionTimeHours,
        alertsByType,
      },
      activeAlerts: {
        lowStock: {
          count: lowStockAlerts.length,
          products: lowStockAlerts.slice(0, limit),
        },
        outOfStock: {
          count: outOfStockAlerts.length,
          products: outOfStockAlerts.slice(0, limit),
        },
        expiringSoon: {
          count: expiringSoonAlerts.length,
          products: expiringSoonAlerts.slice(0, limit),
        },
        expired: {
          count: expiredAlerts.length,
          products: expiredAlerts.slice(0, limit),
        },
      },
      history: {
        resolvedLast7Days,
        resolvedLast30Days,
        resolutionTrend,
        topProductsWithAlerts,
      },
      byCategory,
      details: {
        recentAlerts,
      },
    };
  },
};

// Função auxiliar para obter número da semana
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}
