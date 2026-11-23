// src/controllers/admin/userController.ts
import { Request, Response } from "express";
import { Role } from "../../generated/prisma/enums.js";
import { userService } from "../../services/admin/userService.js";
import {
  CreateStaffUserData,
  UpdateUserProfileData,
  UpdateUserSectorData,
} from "../../types/user.types.js";
import { validateUserName } from "../../utils/validation.js";

export const userController = {
  async createStaffUser(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { email, password, name, role, image, sectorId } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: "Email, senha e nome são obrigatórios",
          code: "MISSING_FIELDS",
        });
      }

      if (!sectorId) {
        return res.status(400).json({
          success: false,
          message: "Setor é obrigatório",
          code: "MISSING_SECTOR",
        });
      }

      const data: CreateStaffUserData = {
        email,
        password,
        name,
        role: role || Role.STAFF,
        image:
          image ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a73e8&color=fff&size=128`,
        sectorId,
      };

      const userResponse = await userService.createStaffUser(data, adminId);

      return res.status(201).json({
        success: true,
        message: "Usuário criado com sucesso!",
        data: userResponse,
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar usuário:", error);

      if (error.message.includes("Email já cadastrado")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "EMAIL_ALREADY_EXISTS",
        });
      }

      if (error.message.includes("Setor não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "SECTOR_NOT_FOUND",
        });
      }

      if (error.message.includes("Setor está desativado")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "SECTOR_INACTIVE",
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
        message: "Erro interno ao criar usuário",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  async listUsers(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const filters = {
        search: req.query.search as string,
        role: req.query.role as Role,
        isActive:
          req.query.isActive === "true"
            ? true
            : req.query.isActive === "false"
              ? false
              : undefined,
        sectorId: req.query.sectorId as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await userService.listUsers(adminId, filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar usuários:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar usuários",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async getUserById(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const userId = typeof id === "string" ? id : id[0];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório",
          code: "MISSING_ID",
        });
      }

      const user = await userService.getUserById(userId, adminId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
          code: "USER_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar usuário:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar usuário",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async toggleUserStatus(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const userId = typeof id === "string" ? id : id[0];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório",
          code: "MISSING_ID",
        });
      }

      const user = await userService.toggleUserStatus(userId, adminId);

      return res.status(200).json({
        success: true,
        message: `Usuário ${user.isActive ? "ativado" : "desativado"} com sucesso!`,
        data: user,
      });
    } catch (error: any) {
      console.error("❌ Erro ao alterar status:", error);

      if (error.message.includes("Usuário não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "USER_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao alterar status do usuário",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async updateUserRole(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const userId = typeof id === "string" ? id : id[0];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório",
          code: "MISSING_ID",
        });
      }

      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "Role é obrigatória",
          code: "MISSING_ROLE",
        });
      }

      if (!Object.values(Role).includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Role inválida. Valores permitidos: ${Object.values(Role).join(", ")}`,
          code: "INVALID_ROLE",
        });
      }

      const user = await userService.updateUserRole(userId, role, adminId);

      return res.status(200).json({
        success: true,
        message: "Role atualizada com sucesso!",
        data: user,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar role:", error);

      // 🔹 Fase 7.6 — guard CANNOT_DEMOTE_SELF
      if (error.message.startsWith("CANNOT_DEMOTE_SELF")) {
        return res.status(400).json({
          success: false,
          message: error.message.replace("CANNOT_DEMOTE_SELF: ", ""),
          code: "CANNOT_DEMOTE_SELF",
        });
      }

      if (error.message.includes("Usuário não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "USER_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar role do usuário",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async updateUserSector(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const userId = typeof id === "string" ? id : id[0];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório",
          code: "MISSING_ID",
        });
      }

      const { sectorId } = req.body;

      if (!sectorId) {
        return res.status(400).json({
          success: false,
          message: "Setor é obrigatório",
          code: "MISSING_SECTOR",
        });
      }

      const data: UpdateUserSectorData = { sectorId };

      const user = await userService.updateUserSector(userId, data, adminId);

      return res.status(200).json({
        success: true,
        message: "Setor atualizado com sucesso!",
        data: user,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar setor:", error);

      if (error.message.includes("Usuário não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "USER_NOT_FOUND",
        });
      }

      if (error.message.includes("Setor não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "SECTOR_NOT_FOUND",
        });
      }

      if (error.message.includes("Setor está desativado")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "SECTOR_INACTIVE",
        });
      }

      if (error.message.includes("Setor é obrigatório")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "MISSING_SECTOR",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar setor do usuário",
        code: "INTERNAL_ERROR",
      });
    }
  },

  // 🔹 NOVO (Fase 7.6) — PATCH /admin/users/:id/profile
  async updateUserProfile(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const userId = typeof id === "string" ? id : id[0];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório",
          code: "MISSING_ID",
        });
      }

      const { name } = req.body;

      // validação no controller (mesmo padrão dos outros endpoints)
      const validation = validateUserName(name);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.errors.join(", "),
          code: "INVALID_NAME",
        });
      }

      const data: UpdateUserProfileData = { name };

      const user = await userService.updateUserProfile(userId, data, adminId);

      return res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso!",
        data: user,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar perfil:", error);

      if (error.message.startsWith("INVALID_NAME")) {
        return res.status(400).json({
          success: false,
          message: error.message.replace("INVALID_NAME: ", ""),
          code: "INVALID_NAME",
        });
      }

      if (error.message.includes("Usuário não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "USER_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar perfil do usuário",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async deleteUser(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const { id } = req.params;
      const userId = typeof id === "string" ? id : id[0];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório",
          code: "MISSING_ID",
        });
      }

      if (userId === adminId) {
        return res.status(400).json({
          success: false,
          message: "Não é possível deletar seu próprio usuário",
          code: "CANNOT_DELETE_SELF",
        });
      }

      // 🔹 Fase 7.6 — o service agora tem os guards de MANAGER e atividade.
      //    Não precisa mais chamar getUserById antes (o service resolve).
      await userService.deleteUser(userId, adminId);

      return res.status(200).json({
        success: true,
        message: "Usuário deletado com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao deletar usuário:", error);

      // 🔹 Fase 7.6
      if (error.message.startsWith("CANNOT_DELETE_MANAGER")) {
        return res.status(400).json({
          success: false,
          message: error.message.replace("CANNOT_DELETE_MANAGER: ", ""),
          code: "CANNOT_DELETE_MANAGER",
        });
      }

      if (error.message.startsWith("USER_HAS_ACTIVITY")) {
        return res.status(409).json({
          success: false,
          message: error.message.replace("USER_HAS_ACTIVITY: ", ""),
          code: "USER_HAS_ACTIVITY",
        });
      }

      if (error.message.includes("Usuário não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "USER_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao deletar usuário",
        code: "INTERNAL_ERROR",
      });
    }
  },

  async getUserOptions(req: Request, res: Response) {
    try {
      const options = await userService.getUserOptions();

      return res.status(200).json({
        success: true,
        data: options,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar opções de usuários:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar opções de usuários",
        code: "INTERNAL_ERROR",
      });
    }
  },
};