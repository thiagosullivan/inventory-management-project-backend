import { ExportFilters } from "../../types/dashboard.types.js";
import { dashboardService } from "./dashboardService.js";

export class ExportService {
  /**
   * Gerar CSV a partir dos dados
   */
  private generateCSV(
    data: any,
    filename: string,
  ): { content: string; filename: string } {
    if (!data || data.length === 0) {
      return {
        content: "No data available",
        filename: `${filename}.csv`,
      };
    }

    // Pegar headers do primeiro item
    const headers = Object.keys(data[0]);

    // Montar linhas do CSV
    const rows = data.map((item: any) => {
      return headers.map((header) => {
        const value = item[header];
        // Tratar valores que podem ter vírgula
        if (typeof value === "string" && value.includes(",")) {
          return `"${value}"`;
        }
        if (value === null || value === undefined) {
          return "";
        }
        return String(value);
      });
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.join(",")),
    ].join("\n");

    return {
      content: csvContent,
      filename: `${filename}.csv`,
    };
  }

  /**
   * Gerar CSV das métricas de overview
   */
  private generateOverviewCSV(overview: any): {
    content: string;
    filename: string;
  } {
    const data = [
      {
        metric: "Total Products",
        value: overview.summary.totalProducts,
      },
      {
        metric: "Total Units",
        value: overview.summary.totalUnits,
      },
      {
        metric: "Total Movements",
        value: overview.summary.totalMovements,
      },
      {
        metric: "Low Stock Products",
        value: overview.alerts.lowStock,
      },
      {
        metric: "Out of Stock Products",
        value: overview.alerts.outOfStock,
      },
      {
        metric: "Expired Products",
        value: overview.alerts.expired,
      },
      {
        metric: "Expiring Soon Products",
        value: overview.alerts.expiringSoon,
      },
      {
        metric: "Active Alerts",
        value: overview.alerts.activeAlerts,
      },
      {
        metric: "Stock Occupancy Rate",
        value: `${overview.ratios.stockOccupancyRate}%`,
      },
      {
        metric: "Active Products",
        value: overview.ratios.activeProducts,
      },
      {
        metric: "Active Products Percentage",
        value: `${overview.ratios.activeProductsPercentage}%`,
      },
    ];

    return this.generateCSV(data, "dashboard_overview");
  }

  /**
   * Gerar CSV das métricas de stock
   */
  private generateStockCSV(stock: any): { content: string; filename: string } {
    const data = [
      {
        metric: "Total Products",
        value: stock.summary.totalProducts,
      },
      {
        metric: "Total Units",
        value: stock.summary.totalUnits,
      },
      {
        metric: "Average Stock Per Product",
        value: stock.summary.averageStockPerProduct,
      },
      {
        metric: "Products With Stock",
        value: stock.summary.productsWithStock,
      },
      {
        metric: "Products Without Stock",
        value: stock.summary.productsWithoutStock,
      },
      {
        metric: "Healthy Stock",
        value: stock.stockStatus.healthy,
      },
      {
        metric: "Low Stock",
        value: stock.stockStatus.low,
      },
      {
        metric: "Out of Stock",
        value: stock.stockStatus.outOfStock,
      },
      {
        metric: "Over Stock",
        value: stock.stockStatus.overStock,
      },
      {
        metric: "Expired Products",
        value: stock.expiryStatus.expired,
      },
      {
        metric: "Expiring Soon",
        value: stock.expiryStatus.expiringSoon,
      },
      {
        metric: "Valid Products",
        value: stock.expiryStatus.valid,
      },
    ];

    return this.generateCSV(data, "dashboard_stock");
  }

  /**
   * Gerar CSV das métricas de atividade
   */
  private generateActivityCSV(activity: any): {
    content: string;
    filename: string;
  } {
    const data = [
      {
        metric: "Total Movements",
        value: activity.summary.totalMovements,
      },
      {
        metric: "Total Entries",
        value: activity.summary.totalEntries,
      },
      {
        metric: "Total Exits",
        value: activity.summary.totalExits,
      },
      {
        metric: "Total Adjustments",
        value: activity.summary.totalAdjustments,
      },
      {
        metric: "Entries/Exits Ratio",
        value: activity.summary.entriesExitsRatio,
      },
      {
        metric: "Average Movements Per Day",
        value: activity.summary.averageMovementsPerDay,
      },
      {
        metric: "Active Users",
        value: activity.byUser.summary.activeUsers,
      },
      {
        metric: "Total Users",
        value: activity.byUser.summary.totalUsers,
      },
      {
        metric: "Most Active User",
        value: activity.byUser.summary.mostActiveUser || "N/A",
      },
      {
        metric: "Most Active User Count",
        value: activity.byUser.summary.mostActiveUserCount,
      },
    ];

    return this.generateCSV(data, "dashboard_activity");
  }

  /**
   * Gerar CSV das métricas de alertas
   */
  private generateAlertsCSV(alerts: any): {
    content: string;
    filename: string;
  } {
    const data = [
      {
        metric: "Total Alerts",
        value: alerts.summary.totalAlerts,
      },
      {
        metric: "Resolved Alerts",
        value: alerts.summary.resolvedAlerts,
      },
      {
        metric: "Active Alerts",
        value: alerts.summary.activeAlerts,
      },
      {
        metric: "Resolution Rate",
        value: `${alerts.summary.resolutionRate}%`,
      },
      {
        metric: "Average Resolution Time (hours)",
        value: alerts.summary.averageResolutionTimeHours,
      },
      {
        metric: "Low Stock Alerts",
        value: alerts.activeAlerts.lowStock.count,
      },
      {
        metric: "Out of Stock Alerts",
        value: alerts.activeAlerts.outOfStock.count,
      },
      {
        metric: "Expiring Soon Alerts",
        value: alerts.activeAlerts.expiringSoon.count,
      },
      {
        metric: "Expired Alerts",
        value: alerts.activeAlerts.expired.count,
      },
      {
        metric: "Resolved Last 7 Days",
        value: alerts.history.resolvedLast7Days,
      },
      {
        metric: "Resolved Last 30 Days",
        value: alerts.history.resolvedLast30Days,
      },
    ];

    return this.generateCSV(data, "dashboard_alerts");
  }

  /**
   * Gerar CSV de produtos detalhado
   */
  private generateProductsCSV(): { content: string; filename: string } {
    // Aqui você pode buscar os produtos diretamente ou usar os dados já existentes
    // Vou buscar diretamente para ter mais detalhes
    return {
      content: "Products export coming soon...",
      filename: "dashboard_products.csv",
    };
  }

  /**
   * Exportar todas as métricas
   */
  async exportAll(filters?: ExportFilters): Promise<{
    files: { content: string; filename: string }[];
    combined: string;
  }> {
    const periodDays = filters?.periodDays || 30;
    const includeOverview = filters?.includeOverview !== false;
    const includeStock = filters?.includeStock !== false;
    const includeActivity = filters?.includeActivity !== false;
    const includeAlerts = filters?.includeAlerts !== false;

    const files: { content: string; filename: string }[] = [];
    const combinedData: any[] = [];

    // Buscar dados
    const [overview, stock, activity, alerts] = await Promise.all([
      includeOverview ? dashboardService.getOverview({ periodDays }) : null,
      includeStock ? dashboardService.getStockMetrics({ limit: 50 }) : null,
      includeActivity
        ? dashboardService.getActivityMetrics({ periodDays, limit: 50 })
        : null,
      includeAlerts ? dashboardService.getAlertsMetrics({ limit: 50 }) : null,
    ]);

    // Overview
    if (overview) {
      const csv = this.generateOverviewCSV(overview);
      files.push(csv);
      combinedData.push({ section: "Overview", ...overview.summary });
    }

    // Stock
    if (stock) {
      const csv = this.generateStockCSV(stock);
      files.push(csv);
      combinedData.push({ section: "Stock", ...stock.summary });
    }

    // Activity
    if (activity) {
      const csv = this.generateActivityCSV(activity);
      files.push(csv);
      combinedData.push({ section: "Activity", ...activity.summary });
    }

    // Alerts
    if (alerts) {
      const csv = this.generateAlertsCSV(alerts);
      files.push(csv);
      combinedData.push({ section: "Alerts", ...alerts.summary });
    }

    // Gerar CSV combinado
    const combined = this.generateCSV(combinedData, "dashboard_complete");

    return {
      files,
      combined: combined.content,
    };
  }

  /**
   * Exportar em formato JSON
   */
  async exportJSON(
    filters?: ExportFilters,
  ): Promise<{ data: any; filename: string }> {
    const periodDays = filters?.periodDays || 30;
    const includeOverview = filters?.includeOverview !== false;
    const includeStock = filters?.includeStock !== false;
    const includeActivity = filters?.includeActivity !== false;
    const includeAlerts = filters?.includeAlerts !== false;

    const result: any = {
      exportedAt: new Date().toISOString(),
      periodDays,
    };

    // Buscar dados
    const [overview, stock, activity, alerts] = await Promise.all([
      includeOverview ? dashboardService.getOverview({ periodDays }) : null,
      includeStock ? dashboardService.getStockMetrics({ limit: 100 }) : null,
      includeActivity
        ? dashboardService.getActivityMetrics({ periodDays, limit: 100 })
        : null,
      includeAlerts ? dashboardService.getAlertsMetrics({ limit: 100 }) : null,
    ]);

    if (overview) result.overview = overview;
    if (stock) result.stock = stock;
    if (activity) result.activity = activity;
    if (alerts) result.alerts = alerts;

    return {
      data: result,
      filename: `dashboard_export_${new Date().toISOString().split("T")[0]}.json`,
    };
  }
}

export default new ExportService();
