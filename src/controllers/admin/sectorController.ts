// src/controllers/admin/sectorController.ts
import { Request, Response } from "express";
import { sectorService } from "../../services/admin/sectorService.js";
import {
  CreateSectorData,
  UpdateSectorData,
} from "../../types/sector.types.js";

export const sectorController = {
  /**
   * Create sector (only MANAGER)
   * POST /api/admin/sectors
   */
  async createSector(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
          code: "UNAUTHENTICATED",
        });
      }

      const data: CreateSectorData = req.body;

      if (!data.name) {
        return res.status(400).json({
          success: false,
          message: "Nome do setor é obrigatório",
          code: "MISSING_NAME",
        });
      }

      const sector = await sectorService.createSector(data);

      return res.status(201).json({
        success: true,
        message: "Setor criado com sucesso!",
        data: sector,
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar setor:", error);

      if (error.message.includes("já existe")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "SECTOR_ALREADY_EXISTS",
        });
      }

      if (error.message.includes("Já existe um setor com isWarehouse")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "WAREHOUSE_ALREADY_EXISTS",
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
        message: "Erro ao criar setor",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * List sectors (STAFF and MANAGER)
   * GET /api/admin/sectors
   */
  async listSectors(req: Request, res: Response) {
    try {
      const filters = {
        search: req.query.search as string,
        isWarehouse:
          req.query.isWarehouse === "true"
            ? true
            : req.query.isWarehouse === "false"
              ? false
              : undefined,
        isActive:
          req.query.isActive === "true"
            ? true
            : req.query.isActive === "false"
              ? false
              : undefined,
      };

      const result = await sectorService.listSectors(filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar setores:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar setores",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Get sector by ID (STAFF and MANAGER)
   * GET /api/admin/sectors/:id
   */
  async getSectorById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const sectorId = typeof id === "string" ? id : id[0];

      if (!sectorId) {
        return res.status(400).json({
          success: false,
          message: "ID do setor é obrigatório",
          code: "MISSING_ID",
        });
      }

      const sector = await sectorService.getSectorById(sectorId);

      if (!sector) {
        return res.status(404).json({
          success: false,
          message: "Setor não encontrado",
          code: "SECTOR_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: sector,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar setor:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar setor",
        code: "INTERNAL_ERROR",
      });
    }
  },

  /**
   * Update sector (only MANAGER)
   * PATCH /api/admin/sectors/:id
   * 🔹 isWarehouse é imutável — rejeita se vier no payload (Opção A)
   */
  async updateSector(req: Request, res: Response) {
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
      const sectorId = typeof id === "string" ? id : id[0];

      if (!sectorId) {
        return res.status(400).json({
          success: false,
          message: "ID do setor é obrigatório",
          code: "MISSING_ID",
        });
      }

      // 🔹 Opção A — isWarehouse é imutável (rejeitar no controller)
      const { isWarehouse, ...rest } = req.body;
      if (isWarehouse !== undefined) {
        return res.status(400).json({
          success: false,
          message:
            "isWarehouse é imutável após criação. Não pode ser alterado.",
          code: "IMMUTABLE_FIELD",
        });
      }

      const data: UpdateSectorData = rest;

      if (
        data.name === undefined &&
        data.description === undefined &&
        data.isActive === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Pelo menos um campo deve ser atualizado",
          code: "NO_DATA_TO_UPDATE",
        });
      }

      const sector = await sectorService.updateSector(sectorId, data);

      return res.status(200).json({
        success: true,
        message: "Setor atualizado com sucesso!",
        data: sector,
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar setor:", error);

      if (error.message.includes("Setor não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "SECTOR_NOT_FOUND",
        });
      }

      if (error.message.includes("já existe")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "SECTOR_ALREADY_EXISTS",
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
        message: "Erro ao atualizar setor",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * Delete sector (only MANAGER)
   * DELETE /api/admin/sectors/:id
   */
  async deleteSector(req: Request, res: Response) {
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
      const sectorId = typeof id === "string" ? id : id[0];

      if (!sectorId) {
        return res.status(400).json({
          success: false,
          message: "ID do setor é obrigatório",
          code: "MISSING_ID",
        });
      }

      await sectorService.deleteSector(sectorId);

      return res.status(200).json({
        success: true,
        message: "Setor deletado com sucesso!",
      });
    } catch (error: any) {
      console.error("❌ Erro ao deletar setor:", error);

      if (error.message.includes("Setor não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: "SECTOR_NOT_FOUND",
        });
      }

      if (error.message.includes("Almoxarifado")) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: "CANNOT_DELETE_WAREHOUSE",
        });
      }

      if (error.message.includes("vinculado")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "SECTOR_HAS_RELATIONS",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao deletar setor",
        code: "INTERNAL_ERROR",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  /**
   * List sector options (STAFF and MANAGER)
   * GET /api/admin/sectors/options
   */
  async getSectorOptions(req: Request, res: Response) {
    try {
      const options = await sectorService.getSectorOptions();

      return res.status(200).json({
        success: true,
        data: options,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar opções de setores:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar opções de setores",
        code: "INTERNAL_ERROR",
      });
    }
  },
};
