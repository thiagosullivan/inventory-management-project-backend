// src/controllers/admin/userController.ts
import { Request, Response } from "express";
import { Role } from "../../generated/prisma/enums.js";
import { userService } from "../../services/admin/userService.js";
import {
  CreateStaffUserData,
  UpdateUserSectorData,
} from "../../types/user.types.js";

export const userController = {
  /**
   * Create user (only MANAGER)
   * POST /api/admin/users
   */
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

      // Validação de campos obrigatórios (controller)
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: "Email, senha e nome são obrigatórios",
          code: "MISSING_FIELDS",
        });
      }

      // 🔹 NOVO — sectorId obrigatório
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
        sectorId, // 🔹 NOVO
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

  /**
   * List users (only MANAGER)
   * GET /api/admin/users
   */
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
        sectorId: req.query.sectorId as string, // 🔹 NOVO
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

  /**
   * Get user by ID (only MANAGER)
   * GET /api/admin/users/:id
   */
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

  /**
   * Toggle user status active/inactive (only MANAGER)
   * PATCH /api/admin/users/:id/status
   */
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

  /**
   * Update user role (only MANAGER)
   * PATCH /api/admin/users/:id/role
   */
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

  /**
   * 🔹 NOVO — Update user sector (only MANAGER)
   * PATCH /api/admin/users/:id/sector
   */
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

  /**
   * Delete user (only MANAGER)
   * DELETE /api/admin/users/:id
   */
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

      // Não permitir deletar a si mesmo
      if (userId === adminId) {
        return res.status(400).json({
          success: false,
          message: "Não é possível deletar seu próprio usuário",
          code: "CANNOT_DELETE_SELF",
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

      await userService.deleteUser(userId, adminId);

      return res.status(200).json({
        success: true,
        message: "Usuário deletado com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao deletar usuário:", error);

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

  /**
   * List user options for dropdowns (STAFF and MANAGER)
   * GET /api/admin/users/options
   */
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
