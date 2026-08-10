import { Request, Response } from "express";
import { dashboardService } from "../../services/admin/dashboardService.js";

export const dashboardController = {
  /**
   * GET /dashboard/overview
   * Get dashboard overview metrics
   */
  async getOverview(req: Request, res: Response) {
    try {
      const periodDays = req.query.periodDays
        ? Number(req.query.periodDays)
        : 30;
      const trendDays = req.query.trendDays ? Number(req.query.trendDays) : 7;

      // Validar parâmetros
      if (periodDays && (isNaN(periodDays) || periodDays < 1)) {
        return res.status(400).json({
          success: false,
          message: "periodDays deve ser um número positivo",
          code: "INVALID_PERIOD",
        });
      }

      if (trendDays && (isNaN(trendDays) || trendDays < 1)) {
        return res.status(400).json({
          success: false,
          message: "trendDays deve ser um número positivo",
          code: "INVALID_TREND",
        });
      }

      const result = await dashboardService.getOverview({
        periodDays,
        trendDays,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar overview do dashboard:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar dados do dashboard",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
};
