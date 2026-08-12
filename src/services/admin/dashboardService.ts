// src/services/admin/dashboardService.ts
import { prisma } from "../../lib/prisma.js";
import {
  DashboardOverviewResponse,
  DashboardOverviewFilters,
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
};
