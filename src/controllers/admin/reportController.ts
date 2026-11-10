// src/controllers/admin/reportController.ts
import { Request, Response } from "express";
import { reportService } from "../../services/admin/reportService.js";
import {
  ConsumptionFilters,
  ManualOutputFilters,
  RequestReportFilters,
} from "../../types/report.types.js";
import { Role } from "../../generated/prisma/enums.js";

/**
 * 🔹 Helper interno: extrai id do usuário logado ou devolve 401.
 * Retorna null se respondeu (a rota para).
 */
function requireAuth(
  req: Request,
  res: Response,
): { userId: string; userSectorId: string; userRole: Role } | null {
  const userId = req.user?.id;
  const userSectorId = req.user?.sectorId;
  const userRole = req.user?.role;

  if (!userId || !userSectorId || !userRole) {
    res.status(401).json({
      success: false,
      message: "Usuário não autenticado",
      code: "UNAUTHENTICATED",
    });
    return null;
  }

  return { userId, userSectorId, userRole: userRole as Role };
}

/**
 * 🔹 Helper interno: mapeia erros de permissão/not-found do service
 * pros status HTTP padrão. Retorna true se já respondeu.
 */
function handleServiceError(
  error: any,
  res: Response,
  context: string,
): boolean {
  console.error(`❌ Erro ao ${context}:`, error);

  const msg: string = error?.message ?? "";

  if (msg.includes("Apenas STAFF do Almoxarifado ou MANAGER")) {
    res.status(403).json({
      success: false,
      message: msg,
      code: "FORBIDDEN",
    });
    return true;
  }

  if (msg.includes("Setor não encontrado")) {
    res.status(404).json({
      success: false,
      message: msg,
      code: "SECTOR_NOT_FOUND",
    });
    return true;
  }

  return false;
}

export const reportController = {
  // ==========================================================
  // R1 — GET /admin/reports/requests
  // ==========================================================
  async getRequestReport(req: Request, res: Response) {
    try {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const filters: RequestReportFilters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        sectorId: req.query.sectorId as string | undefined,
        status: req.query.status as any,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await reportService.getRequestReport(
        filters,
        auth.userSectorId,
        auth.userRole,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (handleServiceError(error, res, "gerar relatório de pedidos")) return;
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar relatório de pedidos",
        code: "INTERNAL_ERROR",
      });
    }
  },

  // ==========================================================
  // R2 — GET /admin/reports/consumption (GLOBAL)
  // ==========================================================
  async getConsumptionGlobal(req: Request, res: Response) {
    try {
      const auth = requireAuth(req, res);
      if (!auth) return;

      // 🔹 priorityThreshold: se veio e não é numérico → 400
      let priorityThreshold: number | undefined;
      if (req.query.priorityThreshold !== undefined) {
        const n = Number(req.query.priorityThreshold);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({
            success: false,
            message: "priorityThreshold deve ser um número >= 0",
            code: "INVALID_PRIORITY_THRESHOLD",
          });
        }
        priorityThreshold = n;
      }

      const filters: ConsumptionFilters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        priorityThreshold,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await reportService.getConsumptionGlobal(
        filters,
        auth.userSectorId,
        auth.userRole,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (handleServiceError(error, res, "gerar relatório de consumo (global)"))
        return;
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar relatório de consumo",
        code: "INTERNAL_ERROR",
      });
    }
  },

  // ==========================================================
  // R2 — GET /admin/reports/consumption/:sectorId
  // ==========================================================
  async getConsumptionBySector(req: Request, res: Response) {
    try {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const { sectorId } = req.params;
      if (!sectorId || typeof sectorId !== "string") {
        return res.status(400).json({
          success: false,
          message: "ID do setor é obrigatório",
          code: "MISSING_SECTOR_ID",
        });
      }

      let priorityThreshold: number | undefined;
      if (req.query.priorityThreshold !== undefined) {
        const n = Number(req.query.priorityThreshold);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({
            success: false,
            message: "priorityThreshold deve ser um número >= 0",
            code: "INVALID_PRIORITY_THRESHOLD",
          });
        }
        priorityThreshold = n;
      }

      const filters: ConsumptionFilters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        priorityThreshold,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await reportService.getConsumptionBySector(
        sectorId,
        filters,
        auth.userSectorId,
        auth.userRole,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (handleServiceError(error, res, "gerar relatório de consumo (setor)"))
        return;
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar relatório de consumo do setor",
        code: "INTERNAL_ERROR",
      });
    }
  },

  // ==========================================================
  // R2b — GET /admin/reports/manual-output
  // ==========================================================
  async getManualOutput(req: Request, res: Response) {
    try {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const filters: ManualOutputFilters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        sectorId: req.query.sectorId as string | undefined,
        productId: req.query.productId as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await reportService.getManualOutput(
        filters,
        auth.userSectorId,
        auth.userRole,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (handleServiceError(error, res, "gerar relatório de saídas manuais"))
        return;
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar relatório de saídas manuais",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
