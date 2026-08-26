import { Request, Response } from "express";
import exportService from "../../services/admin/exportService.js";
import { dashboardService } from "../../services/admin/dashboardService.js";

export const exportController = {
  /**
   * GET /dashboard/export
   * Export dashboard metrics in CSV or JSON
   */
  async exportDashboard(req: Request, res: Response) {
    try {
      const format = (req.query.format as string) || "csv";
      const periodDays = req.query.periodDays
        ? Number(req.query.periodDays)
        : 30;
      const includeOverview = req.query.includeOverview !== "false";
      const includeStock = req.query.includeStock !== "false";
      const includeActivity = req.query.includeActivity !== "false";
      const includeAlerts = req.query.includeAlerts !== "false";

      // Validar parâmetros
      if (periodDays && (isNaN(periodDays) || periodDays < 1)) {
        return res.status(400).json({
          success: false,
          message: "periodDays deve ser um número positivo",
          code: "INVALID_PERIOD",
        });
      }

      if (format !== "csv" && format !== "json") {
        return res.status(400).json({
          success: false,
          message: "Formato inválido. Use 'csv' ou 'json'",
          code: "INVALID_FORMAT",
        });
      }

      const filters = {
        periodDays,
        format: format as "csv" | "json",
        includeOverview,
        includeStock,
        includeActivity,
        includeAlerts,
      };

      if (format === "json") {
        const result = await exportService.exportJSON(filters);

        return res
          .status(200)
          .header("Content-Type", "application/json")
          .header(
            "Content-Disposition",
            `attachment; filename="${result.filename}"`,
          )
          .json(result.data);
      }

      // CSV - Exportar todos os arquivos ou combinado
      const result = await exportService.exportAll(filters);

      // Por padrão, retornar o arquivo combinado
      // Se quiser todos os arquivos separados, enviar como zip (requer dependência extra)

      return res
        .status(200)
        .header("Content-Type", "text/csv")
        .header(
          "Content-Disposition",
          `attachment; filename="dashboard_export_${new Date().toISOString().split("T")[0]}.csv"`,
        )
        .send(result.combined);
    } catch (error: any) {
      console.error("❌ Erro ao exportar dashboard:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao exportar dados do dashboard",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * GET /dashboard/export/overview
   * Export only overview metrics
   */
  async exportOverview(req: Request, res: Response) {
    try {
      const periodDays = req.query.periodDays
        ? Number(req.query.periodDays)
        : 30;
      const format = (req.query.format as string) || "csv";

      if (periodDays && (isNaN(periodDays) || periodDays < 1)) {
        return res.status(400).json({
          success: false,
          message: "periodDays deve ser um número positivo",
          code: "INVALID_PERIOD",
        });
      }

      const overview = await dashboardService.getOverview({ periodDays });

      if (format === "json") {
        return res.status(200).json({
          success: true,
          data: overview,
        });
      }

      // CSV
      const csv = exportService["generateOverviewCSV"](overview);

      return res
        .status(200)
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${csv.filename}"`)
        .send(csv.content);
    } catch (error: any) {
      console.error("❌ Erro ao exportar overview:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao exportar dados",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * GET /dashboard/export/stock
   * Export only stock metrics
   */
  async exportStock(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const format = (req.query.format as string) || "csv";

      const stock = await dashboardService.getStockMetrics({ limit });

      if (format === "json") {
        return res.status(200).json({
          success: true,
          data: stock,
        });
      }

      const csv = exportService["generateStockCSV"](stock);

      return res
        .status(200)
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${csv.filename}"`)
        .send(csv.content);
    } catch (error: any) {
      console.error("❌ Erro ao exportar estoque:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao exportar dados",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
