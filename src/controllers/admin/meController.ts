// src/controllers/admin/meController.ts
import { Request, Response } from "express";
import { meService } from "../../services/admin/meService.js";
import {
  ConfirmEmailChangeData,
  RequestEmailChangeData,
  UpdateMyAvatarData,
  UpdateMyPasswordData,
  UpdateMyProfileData,
} from "../../types/user.types.js";

function buildHeaders(req: Request): Headers {
  return new Headers(req.headers as Record<string, string>);
}

export const meController = {
  /**
   * GET /api/me/profile
   */
  async getMyProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const profile = await meService.getMyProfile(userId);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
          code: "USER_NOT_FOUND",
        });
      }

      return res.status(200).json({ success: true, data: profile });
    } catch (error: any) {
      console.error("❌ Erro ao buscar perfil:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar perfil",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * PATCH /api/me/profile
   */
  async updateMyProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: UpdateMyProfileData = req.body;
      if (!data.name || data.name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Nome deve ter pelo menos 2 caracteres",
          code: "INVALID_NAME",
        });
      }

      const updated = await meService.updateMyProfile(userId, data);
      return res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso!",
        data: updated,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar perfil:", error);

      if (error.message.includes("INVALID_NAME")) {
        return res.status(400).json({
          success: false,
          message: error.message.replace("INVALID_NAME: ", ""),
          code: "INVALID_NAME",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar perfil",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * PATCH /api/me/password
   */
  async updateMyPassword(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: UpdateMyPasswordData = req.body;
      await meService.updateMyPassword(userId, data, buildHeaders(req));

      return res.status(200).json({
        success: true,
        message: "Senha alterada com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao alterar senha:", error);

      // Better Auth lança erro quando currentPassword está errada
      const msg = String(error?.message ?? "");
      if (
        msg.toLowerCase().includes("invalid password") ||
        msg.toLowerCase().includes("current password")
      ) {
        return res.status(400).json({
          success: false,
          message: "Senha atual incorreta",
          code: "INVALID_CURRENT_PASSWORD",
        });
      }

      if (msg.includes("Dados inválidos")) {
        return res.status(400).json({
          success: false,
          message: msg,
          code: "INVALID_DATA",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao alterar senha",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * PATCH /api/me/avatar
   */
  async updateMyAvatar(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: UpdateMyAvatarData = req.body;
      if (!data.url) {
        return res.status(400).json({
          success: false,
          message: "URL do avatar é obrigatória",
          code: "MISSING_URL",
        });
      }

      const updated = await meService.updateMyAvatar(userId, data);
      return res.status(200).json({
        success: true,
        message: "Avatar atualizado com sucesso!",
        data: updated,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar avatar:", error);

      if (error.message.includes("Dados inválidos")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_DATA",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar avatar",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * GET /api/me/sessions
   */
  async listMySessions(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      // currentSessionId vem do middleware? Não — precisamos pegar via auth.api.
      // Solução: usar auth.api.getSession com os headers da request.
      const { auth } = await import("../../lib/auth.js");
      const session = await auth.api.getSession({
        headers: buildHeaders(req),
      });
      const currentSessionId = session?.session?.id ?? "";

      const sessions = await meService.listMySessions(userId, currentSessionId);
      return res.status(200).json({ success: true, data: sessions });
    } catch (error: any) {
      console.error("❌ Erro ao listar sessões:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar sessões",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * DELETE /api/me/sessions/:id
   */
  async revokeMySession(req: Request, res: Response) {
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
      const sessionId = typeof id === "string" ? id : id[0];
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "ID da sessão é obrigatório",
          code: "MISSING_ID",
        });
      }

      const { auth } = await import("../../lib/auth.js");
      const session = await auth.api.getSession({
        headers: buildHeaders(req),
      });
      const currentSessionId = session?.session?.id ?? "";

      await meService.revokeMySession(userId, sessionId, currentSessionId);
      return res.status(200).json({
        success: true,
        message: "Sessão revogada com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao revogar sessão:", error);

      if (error.message.includes("CANNOT_REVOKE_CURRENT_SESSION")) {
        return res.status(400).json({
          success: false,
          message: error.message.replace("CANNOT_REVOKE_CURRENT_SESSION: ", ""),
          code: "CANNOT_REVOKE_CURRENT_SESSION",
        });
      }

      if (error.message.includes("Sessão não encontrada")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "SESSION_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao revogar sessão",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * DELETE /api/me/sessions
   */
  async revokeAllMySessions(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { auth } = await import("../../lib/auth.js");
      const session = await auth.api.getSession({
        headers: buildHeaders(req),
      });
      const currentSessionId = session?.session?.id ?? "";

      const result = await meService.revokeAllMySessions(
        userId,
        currentSessionId,
      );
      return res.status(200).json({
        success: true,
        message: `${result.revoked} sessão(ões) revogada(s)`,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao revogar sessões:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao revogar sessões",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * POST /api/me/email/request-change
   */
  async requestEmailChange(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: RequestEmailChangeData = req.body;
      if (!data.newEmail) {
        return res.status(400).json({
          success: false,
          message: "Novo e-mail é obrigatório",
          code: "MISSING_EMAIL",
        });
      }

      await meService.requestEmailChange(userId, data, buildHeaders(req));

      return res.status(200).json({
        success: true,
        message: "Código enviado para o novo e-mail. Confirme para concluir.",
      });
    } catch (error: any) {
      console.error("❌ Erro ao solicitar troca de e-mail:", error);

      if (error.message.includes("já cadastrado")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "EMAIL_ALREADY_EXISTS",
        });
      }

      if (error.message.includes("Dados inválidos")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_DATA",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao solicitar troca de e-mail",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * POST /api/me/email/confirm-change
   */
  async confirmEmailChange(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: ConfirmEmailChangeData = req.body;
      if (!data.newEmail || !data.otp) {
        return res.status(400).json({
          success: false,
          message: "Novo e-mail e OTP são obrigatórios",
          code: "INVALID_DATA",
        });
      }

      await meService.confirmEmailChange(userId, data, buildHeaders(req));

      return res.status(200).json({
        success: true,
        message: "E-mail alterado com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao confirmar troca de e-mail:", error);

      const msg = String(error?.message ?? "");
      if (
        msg.toLowerCase().includes("otp") ||
        msg.toLowerCase().includes("code")
      ) {
        return res.status(400).json({
          success: false,
          message: "Código inválido ou expirado",
          code: "INVALID_OTP",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao confirmar troca de e-mail",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
