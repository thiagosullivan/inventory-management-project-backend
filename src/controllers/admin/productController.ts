import { Request, Response } from "express";
import { productService } from "../../services/admin/productService.js";
import {
  CreateProductData,
  UpdateProductData,
  MovementData,
  ProductFilters,
} from "../../types/product.types.js";
import { MovementType } from "../../generated/prisma/enums.js";
import { getSkuParam } from "../../utils/request.js";

export const productController = {
  /**
   * Create product (only MANAGER)
   * POST /api/admin/products
   */
  async createProduct(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: CreateProductData = req.body;

      if (!data.name) {
        return res.status(400).json({
          success: false,
          message: "Nome do produto é obrigatório",
          code: "MISSING_NAME",
        });
      }

      if (!data.category) {
        return res.status(400).json({
          success: false,
          message: "Categoria do produto é obrigatória",
          code: "MISSING_CATEGORY",
        });
      }

      const product = await productService.createProduct(data, userId);

      return res.status(201).json({
        success: true,
        message: "Produto criado com sucesso!",
        data: product,
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar produto:", error);

      if (error.message.includes("Dados inválidos")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_DATA",
        });
      }

      if (error.message.includes("SKU")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "SKU_ALREADY_EXISTS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao criar produto",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * List products (STAFF and MANAGER)
   * GET /api/admin/products
   */
  async listProducts(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const filters: ProductFilters = {
        search: req.query.search as string,
        category: req.query.category as any,
        minQuantity: req.query.minQuantity
          ? Number(req.query.minQuantity)
          : undefined,
        maxQuantity: req.query.maxQuantity
          ? Number(req.query.maxQuantity)
          : undefined,
        hasExpiryDate:
          req.query.hasExpiryDate === "true"
            ? true
            : req.query.hasExpiryDate === "false"
              ? false
              : undefined,
        isExpiring: req.query.isExpiring === "true",
        isLowStock: req.query.isLowStock === "true",
        createdById: req.query.createdById as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      };

      const result = await productService.listProducts(filters, userId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar produtos:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar produtos",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get product by ID (STAFF and MANAGER)
   * GET /api/admin/products/:id
   */
  async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const productId = typeof id === "string" ? id : id[0];

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "ID do produto é obrigatório",
          code: "MISSING_ID",
        });
      }

      const product = await productService.getProductById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Produto não encontrado",
          code: "PRODUCT_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar produto:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar produto",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get product by SKU (STAFF and MANAGER)
   * GET /api/admin/products/sku/:sku
   */
  async getProductBySku(req: Request, res: Response) {
    try {
      const sku = getSkuParam(req);

      if (!sku) {
        return res.status(400).json({
          success: false,
          message: "SKU é obrigatório",
          code: "MISSING_SKU",
        });
      }

      const product = await productService.getProductBySku(sku);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Produto não encontrado",
          code: "PRODUCT_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar produto por SKU:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar produto",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Update product (only MANAGER)
   * PATCH /api/admin/products/:id
   */
  async updateProduct(req: Request, res: Response) {
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
      const productId = typeof id === "string" ? id : id[0];

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "ID do produto é obrigatório",
          code: "MISSING_ID",
        });
      }

      const data: UpdateProductData = req.body;

      if (
        !data.name &&
        data.sku === undefined &&
        !data.description &&
        !data.category &&
        data.quantity === undefined &&
        data.minStock === undefined &&
        data.maxStock === undefined &&
        data.expiryDate === undefined &&
        !data.batchNumber &&
        !data.location &&
        !data.supplier
      ) {
        return res.status(400).json({
          success: false,
          message: "Pelo menos um campo deve ser atualizado",
          code: "NO_DATA_TO_UPDATE",
        });
      }

      const product = await productService.updateProduct(
        productId,
        data,
        userId,
      );

      return res.status(200).json({
        success: true,
        message: "Produto atualizado com sucesso!",
        data: product,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar produto:", error);

      if (error.message.includes("Produto não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "PRODUCT_NOT_FOUND",
        });
      }

      if (error.message.includes("Dados inválidos")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INVALID_DATA",
        });
      }

      if (error.message.includes("SKU")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "SKU_ALREADY_EXISTS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar produto",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Delete product (only MANAGER)
   * DELETE /api/admin/products/:id
   */
  async deleteProduct(req: Request, res: Response) {
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
      const productId = typeof id === "string" ? id : id[0];

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "ID do produto é obrigatório",
          code: "MISSING_ID",
        });
      }

      await productService.deleteProduct(productId, userId);

      return res.status(200).json({
        success: true,
        message: "Produto deletado com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao deletar produto:", error);

      if (error.message.includes("Produto não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "PRODUCT_NOT_FOUND",
        });
      }

      if (error.message.includes("possui movimentações")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "PRODUCT_HAS_MOVEMENTS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao deletar produto",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Criar stock movement (STAFF and MANAGER)
   * POST /api/admin/products/:id/movements
   */
  async createMovement(req: Request, res: Response) {
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
      const productId = typeof id === "string" ? id : id[0];

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "ID do produto é obrigatório",
          code: "MISSING_ID",
        });
      }

      const { type, quantity, reason } = req.body;

      if (!type) {
        return res.status(400).json({
          success: false,
          message: "Tipo de movimentação é obrigatório",
          code: "MISSING_TYPE",
        });
      }

      if (!Object.values(MovementType).includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Tipo inválido. Valores permitidos: ${Object.values(MovementType).join(", ")}`,
          code: "INVALID_TYPE",
        });
      }

      if (quantity === undefined || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantidade deve ser maior que zero",
          code: "INVALID_QUANTITY",
        });
      }

      const movementData: MovementData = {
        productId,
        type,
        quantity,
        reason,
      };

      const movement = await productService.createMovement(
        movementData,
        userId,
      );

      return res.status(201).json({
        success: true,
        message: "Movimentação realizada com sucesso!",
        data: movement,
      });
    } catch (error: any) {
      console.error("❌ Erro ao movimentar estoque:", error);

      if (error.message.includes("Produto não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "PRODUCT_NOT_FOUND",
        });
      }

      if (error.message.includes("Estoque insuficiente")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "INSUFFICIENT_STOCK",
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
        message: "Erro ao movimentar estoque",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Resolve stock alert (STAFF and MANAGER)
   * PATCH /api/admin/alerts/:id/resolve
   */
  async resolveAlert(req: Request, res: Response) {
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
      const alertId = typeof id === "string" ? id : id[0];

      if (!alertId) {
        return res.status(400).json({
          success: false,
          message: "ID do alerta é obrigatório",
          code: "MISSING_ID",
        });
      }

      await productService.resolveAlert(alertId, userId);

      return res.status(200).json({
        success: true,
        message: "Alerta resolvido com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao resolver alerta:", error);

      if (error.message.includes("Alerta não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "ALERT_NOT_FOUND",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao resolver alerta",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Stock summary (STAFF and MANAGER)
   * GET /api/admin/stock/summary
   */
  async getStockSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const summary = await productService.getStockSummary(userId);

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      console.error("❌ Erro ao obter resumo do estoque:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao obter resumo do estoque",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Buscar movimentações de um produto (STAFF e MANAGER)
   * GET /api/admin/products/:id/movements
   */
  async getProductMovements(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const productId = typeof id === "string" ? id : id[0];

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "ID do produto é obrigatório",
          code: "MISSING_ID",
        });
      }

      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const result = await productService.getProductMovements(
        productId,
        limit,
        offset,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar movimentações:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar movimentações",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get product history (STAFF and MANAGER)
   * GET /api/admin/products/:id/history
   */
  async getProductHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const productId = typeof id === "string" ? id : id[0];

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "ID do produto é obrigatório",
          code: "MISSING_ID",
        });
      }

      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const result = await productService.getProductHistory(
        productId,
        limit,
        offset,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar histórico:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar histórico",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
