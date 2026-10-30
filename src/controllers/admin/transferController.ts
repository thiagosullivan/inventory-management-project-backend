// src/controllers/admin/transferController.ts
import { Request, Response } from "express";
import { transferService } from "../../services/admin/transferService.js";
import {
  CancelTransferData,
  CreateTransferData,
  TransferFilters,
  TransferStatus,
} from "../../types/transfer.types.js";

export const transferController = {
  /**
   * Create transfer (only STAFF do Almoxarifado ou MANAGER)
   * POST /api/admin/transfers
   */
  async createTransfer(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userSectorId = req.user?.sectorId;
      const userRole = req.user?.role;

      if (!userId || !userSectorId || !userRole) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: CreateTransferData = req.body;

      if (!data.toSectorId) {
        return res.status(400).json({
          success: false,
          message: "Setor destino é obrigatório",
          code: "MISSING_TO_SECTOR",
        });
      }

      if (!data.items || data.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Remessa deve ter pelo menos 1 item",
          code: "MISSING_ITEMS",
        });
      }

      const transfer = await transferService.createTransfer(
        data,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(201).json({
        success: true,
        message: "Remessa criada com sucesso!",
        data: transfer,
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar remessa:", error);

      if (error.message.includes("Apenas STAFF do Almoxarifado")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      if (error.message.includes("Setor destino não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "SECTOR_NOT_FOUND",
        });
      }

      if (error.message.includes("Setor destino está desativado")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "SECTOR_INACTIVE",
        });
      }

      if (
        error.message.includes("Não é possível transferir para o Almoxarifado")
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_DESTINATION",
        });
      }

      if (error.message.includes("Produto duplicado")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "DUPLICATE_PRODUCT",
        });
      }

      if (error.message.includes("Quantidade inválida")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_QUANTITY",
        });
      }

      if (error.message.includes("Pedido não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "REQUEST_NOT_FOUND",
        });
      }

      if (error.message.includes("Pedido não pode receber remessa")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_REQUEST_STATUS",
        });
      }

      if (error.message.includes("Pedido pertence a outro setor")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "SECTOR_MISMATCH",
        });
      }

      if (error.message.includes("Estoque insuficiente")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INSUFFICIENT_STOCK",
        });
      }

      if (error.message.includes("Produto não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "PRODUCT_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao criar remessa",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * List transfers (filtrada por setor do user)
   * GET /api/admin/transfers
   */
  async listTransfers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userSectorId = req.user?.sectorId;
      const userRole = req.user?.role;

      if (!userId || !userSectorId || !userRole) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const filters: TransferFilters = {
        status: req.query.status as TransferStatus | undefined,
        fromSectorId: req.query.fromSectorId as string | undefined,
        toSectorId: req.query.toSectorId as string | undefined,
        purchaseRequestId: req.query.purchaseRequestId as string | undefined,
        createdById: req.query.createdById as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await transferService.listTransfers(
        filters,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar remessas:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar remessas",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get transfer by ID
   * GET /api/admin/transfers/:id
   */
  async getTransferById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userSectorId = req.user?.sectorId;
      const userRole = req.user?.role;

      if (!userId || !userSectorId || !userRole) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const transferId = typeof id === "string" ? id : id[0];

      if (!transferId) {
        return res.status(400).json({
          success: false,
          message: "ID da remessa é obrigatório",
          code: "MISSING_ID",
        });
      }

      const transfer = await transferService.getTransferById(
        transferId,
        userSectorId,
        userRole,
      );

      if (!transfer) {
        return res.status(404).json({
          success: false,
          message: "Remessa não encontrada",
          code: "TRANSFER_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: transfer,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar remessa:", error);

      if (error.message.includes("não tem permissão")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao buscar remessa",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Confirm transfer (STAFF do destino ou MANAGER)
   * PATCH /api/admin/transfers/:id/confirm
   */
  async confirmTransfer(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userSectorId = req.user?.sectorId;
      const userRole = req.user?.role;

      if (!userId || !userSectorId || !userRole) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const transferId = typeof id === "string" ? id : id[0];

      if (!transferId) {
        return res.status(400).json({
          success: false,
          message: "ID da remessa é obrigatório",
          code: "MISSING_ID",
        });
      }

      const transfer = await transferService.confirmTransfer(
        transferId,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        message: "Remessa confirmada com sucesso!",
        data: transfer,
      });
    } catch (error: any) {
      console.error("❌ Erro ao confirmar remessa:", error);

      if (error.message.includes("não encontrada")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "TRANSFER_NOT_FOUND",
        });
      }

      if (error.message.includes("Apenas STAFF do setor destino")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      if (error.message.includes("não pode ser confirmada")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_STATUS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao confirmar remessa",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Refuse transfer (STAFF do destino ou MANAGER)
   * PATCH /api/admin/transfers/:id/refuse
   */
  async refuseTransfer(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userSectorId = req.user?.sectorId;
      const userRole = req.user?.role;

      if (!userId || !userSectorId || !userRole) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const transferId = typeof id === "string" ? id : id[0];

      if (!transferId) {
        return res.status(400).json({
          success: false,
          message: "ID da remessa é obrigatório",
          code: "MISSING_ID",
        });
      }

      const transfer = await transferService.refuseTransfer(
        transferId,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        message: "Remessa recusada. Estoque devolvido ao Almoxarifado.",
        data: transfer,
      });
    } catch (error: any) {
      console.error("❌ Erro ao recusar remessa:", error);

      if (error.message.includes("não encontrada")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "TRANSFER_NOT_FOUND",
        });
      }

      if (error.message.includes("Apenas STAFF do setor destino")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      if (error.message.includes("não pode ser recusada")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_STATUS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao recusar remessa",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Cancel transfer (STAFF do Almoxarifado ou MANAGER, só PENDENTE)
   * PATCH /api/admin/transfers/:id/cancel
   */
  async cancelTransfer(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userSectorId = req.user?.sectorId;
      const userRole = req.user?.role;

      if (!userId || !userSectorId || !userRole) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const transferId = typeof id === "string" ? id : id[0];

      if (!transferId) {
        return res.status(400).json({
          success: false,
          message: "ID da remessa é obrigatório",
          code: "MISSING_ID",
        });
      }

      const { cancelReason } = req.body;

      if (!cancelReason || !cancelReason.trim()) {
        return res.status(400).json({
          success: false,
          message: "Motivo do cancelamento é obrigatório",
          code: "MISSING_CANCEL_REASON",
        });
      }

      const data: CancelTransferData = { cancelReason };

      const transfer = await transferService.cancelTransfer(
        transferId,
        data,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        message: "Remessa cancelada. Estoque devolvido ao Almoxarifado.",
        data: transfer,
      });
    } catch (error: any) {
      console.error("❌ Erro ao cancelar remessa:", error);

      if (error.message.includes("não encontrada")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "TRANSFER_NOT_FOUND",
        });
      }

      if (
        error.message.includes("Apenas STAFF do Almoxarifado") ||
        error.message.includes("Apenas remessas originadas do Almoxarifado")
      ) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      if (error.message.includes("não pode ser cancelada")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_STATUS",
        });
      }

      if (error.message.includes("Motivo do cancelamento é obrigatório")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "MISSING_CANCEL_REASON",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao cancelar remessa",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
