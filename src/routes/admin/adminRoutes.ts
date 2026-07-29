import express from "express";
import { authenticate, isManager } from "../../middlewares/auth.js";
import { Role } from "../../generated/prisma/enums.js";
import { userService } from "../../services/admin/userService.js";

const adminRouter = express.Router();

// 🔒 Apenas MANAGER pode acessar rotas de usuários
adminRouter.use(authenticate);
adminRouter.use(isManager);

// GET /admin/users - List users
adminRouter.get("/", async (req, res) => {
  try {
    const adminId = req.user?.id!;
    const filters = {
      search: req.query.search as string,
      role: req.query.role as Role,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
            ? false
            : undefined,
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
});

// POST /admin/users - Create user
adminRouter.post("/", async (req, res) => {
  try {
    const adminId = req.user?.id!;
    const { email, password, name, role, image } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Email, senha e nome são obrigatórios",
        code: "MISSING_FIELDS",
      });
    }

    const userResponse = await userService.createStaffUser(
      {
        email,
        password,
        name,
        role: role || Role.STAFF,
        image:
          image ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a73e8&color=fff&size=128`,
      },
      adminId,
    );

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

    return res.status(500).json({
      success: false,
      message: "Erro interno ao criar usuário",
      code: "INTERNAL_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /admin/users/:id - Get user by ID
adminRouter.get("/:id", async (req, res) => {
  try {
    const adminId = req.user?.id!;
    const userId = req.params.id;

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
});

// PATCH /admin/users/:id/status - Active/Deactive
adminRouter.patch("/:id/status", async (req, res) => {
  try {
    const adminId = req.user?.id!;
    const userId = req.params.id;

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
});

// PATCH /admin/users/:id/role - Update role
adminRouter.patch("/:id/role", async (req, res) => {
  try {
    const adminId = req.user?.id!;
    const userId = req.params.id;
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
});

// DELETE /admin/users/:id - Delete user
adminRouter.delete("/:id", async (req, res) => {
  try {
    const adminId = req.user?.id!;
    const userId = req.params.id;

    // Verificar se o usuário existe
    const user = await userService.getUserById(userId, adminId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
        code: "USER_NOT_FOUND",
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
});

export default adminRouter;
