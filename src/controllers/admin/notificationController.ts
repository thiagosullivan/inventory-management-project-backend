// src/controllers/admin/notificationController.ts
import { Request, Response } from "express";
import { notificationService } from "../../services/admin/notificationService.js";

export const notificationController = {
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const result = await notificationService.listMyNotifications(userId, {
        unreadOnly: req.query.unreadOnly === "true",
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error("❌ Erro ao listar notificações:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar notificações",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async unreadCount(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }
      const count = await notificationService.unreadCount(userId);
      return res.status(200).json({ success: true, data: { count } });
    } catch (error: any) {
      console.error("❌ Erro ao contar notificações:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao contar notificações",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async markRead(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }
      const { id } = req.params;
      const notificationId = typeof id === "string" ? id : id[0];
      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: "ID da notificação é obrigatório",
          code: "MISSING_ID",
        });
      }

      await notificationService.markRead(userId, notificationId);
      return res
        .status(200)
        .json({ success: true, message: "Notificação marcada como lida" });
    } catch (error: any) {
      if (error.message.includes("NOTIFICATION_NOT_FOUND")) {
        return res.status(404).json({
          success: false,
          message: "Notificação não encontrada",
          code: "NOTIFICATION_NOT_FOUND",
        });
      }
      console.error("❌ Erro ao marcar notificação:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao marcar notificação",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async markAllRead(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }
      const result = await notificationService.markAllRead(userId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error("❌ Erro ao marcar todas:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao marcar todas as notificações",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
