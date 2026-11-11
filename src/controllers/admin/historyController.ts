// src/controllers/admin/historyController.ts
import { Request, Response } from "express";
import { historyService } from "../../services/admin/historyService.js";
import { HistoryFilters } from "../../types/history.types.js";
import { MovementStatus, MovementType } from "../../generated/prisma/enums.js";
import { Role } from "../../generated/prisma/enums.js";

/**
 * 🔹 Helper: 401 se req.user incompleto.
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

  return { userId, userSectorId, userRole };
}

export const historyController = {
  /**
   * GET /admin/history
   * Lista unificada de Movements + Transfers.
   */
  async listHistory(req: Request, res: Response) {
    try {
      const auth = requireAuth(req, res);
      if (!auth) return;

      // includeTransfers: aceita "true"/"false" na query
      let includeTransfers: boolean | undefined;
      if (req.query.includeTransfers !== undefined) {
        const raw = String(req.query.includeTransfers).toLowerCase();
        if (raw !== "true" && raw !== "false") {
          return res.status(400).json({
            success: false,
            message: "includeTransfers deve ser 'true' ou 'false'",
            code: "INVALID_INCLUDE_TRANSFERS",
          });
        }
        includeTransfers = raw === "true";
      }

      const filters: HistoryFilters = {
        type: req.query.type as MovementType | undefined,
        status: req.query.status as MovementStatus | undefined,
        createdById: req.query.createdById as string | undefined,
        productId: req.query.productId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sortOrder: req.query.sortOrder as any,
        includeTransfers,
      };

      const result = await historyService.listHistory(
        filters,
        auth.userSectorId,
        auth.userRole,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar histórico:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar histórico",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
