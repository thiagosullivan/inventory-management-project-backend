// src/controllers/admin/purchaseRequestController.ts
import { Request, Response } from "express";
import { purchaseRequestService } from "../../services/admin/purchaseRequestService.js";
import {
  CreatePurchaseRequestData,
  FinalizePurchaseRequestData,
  PurchaseRequestFilters,
  PurchaseRequestStatus,
  RefusePurchaseRequestData,
} from "../../types/purchaseRequest.types.js";

export const purchaseRequestController = {
  /**
   * Create purchase request (STAFF do setor não-Almoxarifado ou MANAGER)
   * POST /api/admin/purchase-requests
   */
  async createPurchaseRequest(req: Request, res: Response) {
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

      const data: CreatePurchaseRequestData = req.body;

      if (!data.items || data.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Pedido deve ter pelo menos 1 item cadastrado",
          code: "MISSING_ITEMS",
        });
      }

      const request = await purchaseRequestService.createPurchaseRequest(
        data,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(201).json({
        success: true,
        message: "Pedido criado com sucesso!",
        data: request,
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar pedido:", error);

      if (error.message.includes("O Almoxarifado não cria pedidos")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
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

      if (error.message.includes("não encontrado(s)")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "PRODUCT_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao criar pedido",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * List purchase requests (filtrada por setor do user)
   * GET /api/admin/purchase-requests
   */
  async listPurchaseRequests(req: Request, res: Response) {
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

      const filters: PurchaseRequestFilters = {
        sectorId: req.query.sectorId as string | undefined,
        status: req.query.status as PurchaseRequestStatus | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await purchaseRequestService.listPurchaseRequests(
        filters,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar pedidos:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar pedidos",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get purchase request by ID
   * GET /api/admin/purchase-requests/:id
   */
  async getPurchaseRequestById(req: Request, res: Response) {
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
      const requestId = typeof id === "string" ? id : id[0];

      if (!requestId) {
        return res.status(400).json({
          success: false,
          message: "ID do pedido é obrigatório",
          code: "MISSING_ID",
        });
      }

      const request = await purchaseRequestService.getPurchaseRequestById(
        requestId,
        userSectorId,
        userRole,
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado",
          code: "REQUEST_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar pedido:", error);

      if (error.message.includes("não tem permissão")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao buscar pedido",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Refuse purchase request (Almoxarifado STAFF ou MANAGER)
   * PATCH /api/admin/purchase-requests/:id/refuse
   */
  async refusePurchaseRequest(req: Request, res: Response) {
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
      const requestId = typeof id === "string" ? id : id[0];

      if (!requestId) {
        return res.status(400).json({
          success: false,
          message: "ID do pedido é obrigatório",
          code: "MISSING_ID",
        });
      }

      const { refusalReason } = req.body;

      if (!refusalReason || !refusalReason.trim()) {
        return res.status(400).json({
          success: false,
          message: "Motivo da recusa é obrigatório",
          code: "MISSING_REFUSAL_REASON",
        });
      }

      const data: RefusePurchaseRequestData = { refusalReason };

      const request = await purchaseRequestService.refusePurchaseRequest(
        requestId,
        data,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        message: "Pedido recusado com sucesso.",
        data: request,
      });
    } catch (error: any) {
      console.error("❌ Erro ao recusar pedido:", error);

      if (error.message.includes("não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "REQUEST_NOT_FOUND",
        });
      }

      if (error.message.includes("Apenas STAFF do Almoxarifado")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      if (error.message.includes("não pode ser recusado")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_STATUS",
        });
      }

      if (error.message.includes("Motivo da recusa é obrigatório")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "MISSING_REFUSAL_REASON",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao recusar pedido",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Finalize purchase request (Almoxarifado STAFF ou MANAGER)
   * PATCH /api/admin/purchase-requests/:id/finalize
   */
  async finalizePurchaseRequest(req: Request, res: Response) {
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
      const requestId = typeof id === "string" ? id : id[0];

      if (!requestId) {
        return res.status(400).json({
          success: false,
          message: "ID do pedido é obrigatório",
          code: "MISSING_ID",
        });
      }

      const data: FinalizePurchaseRequestData = {
        finalizeNote: req.body.finalizeNote,
      };

      const request = await purchaseRequestService.finalizePurchaseRequest(
        requestId,
        data,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        message: "Pedido finalizado com sucesso!",
        data: request,
      });
    } catch (error: any) {
      console.error("❌ Erro ao finalizar pedido:", error);

      if (error.message.includes("não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "REQUEST_NOT_FOUND",
        });
      }

      if (error.message.includes("Apenas STAFF do Almoxarifado")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      if (error.message.includes("Apenas pedidos EM_ATENDIMENTO")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_STATUS",
        });
      }

      if (error.message.includes("remessa(s) pendente(s)")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "PENDING_TRANSFERS",
        });
      }

      if (error.message.includes("Justificativa obrigatória")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "MISSING_FINALIZE_NOTE",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao finalizar pedido",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Cancel purchase request (só setor criador ou MANAGER)
   * PATCH /api/admin/purchase-requests/:id/cancel
   */
  async cancelPurchaseRequest(req: Request, res: Response) {
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
      const requestId = typeof id === "string" ? id : id[0];

      if (!requestId) {
        return res.status(400).json({
          success: false,
          message: "ID do pedido é obrigatório",
          code: "MISSING_ID",
        });
      }

      const request = await purchaseRequestService.cancelPurchaseRequest(
        requestId,
        userId,
        userSectorId,
        userRole,
      );

      return res.status(200).json({
        success: true,
        message: "Pedido cancelado com sucesso.",
        data: request,
      });
    } catch (error: any) {
      console.error("❌ Erro ao cancelar pedido:", error);

      if (error.message.includes("não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "REQUEST_NOT_FOUND",
        });
      }

      if (error.message.includes("Apenas o setor criador")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "FORBIDDEN",
        });
      }

      if (error.message.includes("não pode ser cancelado")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_STATUS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao cancelar pedido",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get catalog for purchase request (STAFF + MANAGER)
   * GET /api/admin/purchase-requests/catalog
   */
  async getCatalog(req: Request, res: Response) {
    try {
      const catalog = await purchaseRequestService.getCatalog();

      return res.status(200).json({
        success: true,
        data: catalog,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar catálogo:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar catálogo",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
