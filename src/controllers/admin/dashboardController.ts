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

  /**
   * GET /dashboard/stock
   * Get stock and products metrics
   */
  async getStockMetrics(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const category = req.query.category as string;
      const location = req.query.location as string;
      const supplier = req.query.supplier as string;

      // Validar parâmetros
      if (limit && (isNaN(limit) || limit < 1)) {
        return res.status(400).json({
          success: false,
          message: "limit deve ser um número positivo",
          code: "INVALID_LIMIT",
        });
      }

      const result = await dashboardService.getStockMetrics({
        limit,
        category,
        location,
        supplier,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar métricas de estoque:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar métricas de estoque",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * GET /dashboard/activity
   * Get activity metrics (movements and users)
   */
  async getActivityMetrics(req: Request, res: Response) {
    try {
      const periodDays = req.query.periodDays
        ? Number(req.query.periodDays)
        : 30;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const userId = req.query.userId as string;
      const productId = req.query.productId as string;
      const type = req.query.type as string;

      // Validar parâmetros
      if (periodDays && (isNaN(periodDays) || periodDays < 1)) {
        return res.status(400).json({
          success: false,
          message: "periodDays deve ser um número positivo",
          code: "INVALID_PERIOD",
        });
      }

      if (limit && (isNaN(limit) || limit < 1)) {
        return res.status(400).json({
          success: false,
          message: "limit deve ser um número positivo",
          code: "INVALID_LIMIT",
        });
      }

      const result = await dashboardService.getActivityMetrics({
        periodDays,
        limit,
        userId,
        productId,
        type,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar métricas de atividade:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar métricas de atividade",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * GET /dashboard/alerts
   * Get alerts metrics
   */
  async getAlertsMetrics(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const alertType = req.query.alertType as string;
      const isResolved =
        req.query.isResolved === "true"
          ? true
          : req.query.isResolved === "false"
            ? false
            : undefined;
      const productId = req.query.productId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      // Validar parâmetros
      if (limit && (isNaN(limit) || limit < 1)) {
        return res.status(400).json({
          success: false,
          message: "limit deve ser um número positivo",
          code: "INVALID_LIMIT",
        });
      }

      const result = await dashboardService.getAlertsMetrics({
        limit,
        alertType,
        isResolved,
        productId,
        startDate,
        endDate,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar métricas de alertas:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar métricas de alertas",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
};
