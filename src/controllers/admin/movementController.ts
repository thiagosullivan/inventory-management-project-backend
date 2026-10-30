// src/controllers/admin/movementController.ts
import { Request, Response } from "express";
import { movementService } from "../../services/admin/movementService.js";
import { MovementType, MovementStatus } from "../../generated/prisma/enums.js";

export const movementController = {
  /**
   * List movements globally (STAFF + MANAGER)
   * GET /api/admin/movements
   * Preparatório pra /history (Fase 6.5)
   */
  async listMovements(req: Request, res: Response) {
    try {
      const filters = {
        type: req.query.type as MovementType | undefined,
        status: req.query.status as MovementStatus | undefined,
        createdById: req.query.createdById as string | undefined,
        productId: req.query.productId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await movementService.listMovements(filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar movimentações:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar movimentações",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
