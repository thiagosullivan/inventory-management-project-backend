// src/controllers/admin/categoryController.ts
import { Request, Response } from "express";
import { categoryService } from "../../services/admin/categoryService.js";
import {
  CreateCategoryData,
  UpdateCategoryData,
} from "../../types/category.types.js";

export const categoryController = {
  /**
   * Create category (only MANAGER)
   * POST /api/admin/categories
   */
  async createCategory(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: CreateCategoryData = req.body;

      if (!data.name) {
        return res.status(400).json({
          success: false,
          message: "Nome da categoria é obrigatório",
          code: "MISSING_NAME",
        });
      }

      const category = await categoryService.createCategory(data, adminId);

      return res.status(201).json({
        success: true,
        message: "Categoria criada com sucesso!",
        data: category,
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar categoria:", error);

      if (error.message.includes("Dados inválidos")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_DATA",
        });
      }

      if (error.message.includes("já existe")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "CATEGORY_ALREADY_EXISTS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao criar categoria",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * List all categories (STAFF and MANAGER)
   * GET /api/admin/categories
   */
  async listCategories(req: Request, res: Response) {
    try {
      const filters = {
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await categoryService.listCategories(filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar categorias:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar categorias",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get category by ID (STAFF and MANAGER)
   * GET /api/admin/categories/:id
   */
  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const categoryId = typeof id === "string" ? id : id[0];

      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: "ID da categoria é obrigatório",
          code: "MISSING_ID",
        });
      }

      const category = await categoryService.getCategoryById(categoryId);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Categoria não encontrada",
          code: "CATEGORY_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar categoria:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar categoria",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Update category (only MANAGER)
   * PATCH /api/admin/categories/:id
   */
  async updateCategory(req: Request, res: Response) {
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
      const categoryId = typeof id === "string" ? id : id[0];

      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: "ID da categoria é obrigatório",
          code: "MISSING_ID",
        });
      }

      const data: UpdateCategoryData = req.body;

      if (!data.name && !data.description) {
        return res.status(400).json({
          success: false,
          message: "Pelo menos um campo deve ser atualizado",
          code: "NO_DATA_TO_UPDATE",
        });
      }

      const category = await categoryService.updateCategory(
        categoryId,
        data,
        adminId,
      );

      return res.status(200).json({
        success: true,
        message: "Categoria atualizada com sucesso!",
        data: category,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar categoria:", error);

      if (error.message.includes("Categoria não encontrada")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "CATEGORY_NOT_FOUND",
        });
      }

      if (error.message.includes("Dados inválidos")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_DATA",
        });
      }

      if (error.message.includes("já existe")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "CATEGORY_ALREADY_EXISTS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar categoria",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Delete category (only MANAGER)
   * DELETE /api/admin/categories/:id
   */
  async deleteCategory(req: Request, res: Response) {
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
      const categoryId = typeof id === "string" ? id : id[0];

      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: "ID da categoria é obrigatório",
          code: "MISSING_ID",
        });
      }

      await categoryService.deleteCategory(categoryId, adminId);

      return res.status(200).json({
        success: true,
        message: "Categoria deletada com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao deletar categoria:", error);

      if (error.message.includes("Categoria não encontrada")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "CATEGORY_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao deletar categoria",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * List category for dropdown (STAFF and MANAGER)
   * GET /api/admin/categories/options
   */
  async getCategoryOptions(req: Request, res: Response) {
    try {
      const options = await categoryService.getCategoryOptions();

      return res.status(200).json({
        success: true,
        data: options,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar opções de categorias:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar opções de categorias",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
