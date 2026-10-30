// src/services/admin/sectorService.ts
import { prisma } from "../../lib/prisma.js";
import {
  CreateSectorData,
  UpdateSectorData,
  SectorResponse,
  SectorsListResponse,
  SectorFilters,
  SectorOption,
} from "../../types/sector.types.js";
import { normalizeText } from "../../utils/validation.js";

let cachedAlmoxarifadoId: string | null = null;

/**
 * 🔹 Garante que só existe 1 setor com isWarehouse: true no sistema.
 * Usado no create (antes de criar) e no update (se tentar mudar isWarehouse).
 */
async function countWarehouses(excludeId?: string): Promise<number> {
  return prisma.sector.count({
    where: {
      isWarehouse: true,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
}

/**
 * 🔹 Checa se o setor pode ser deletado:
 * - Não pode ser o Almoxarifado (isWarehouse: true)
 * - Não pode ter usuários vinculados
 * - Não pode ter Transfer (from/to) vinculada
 * - Não pode ter PurchaseRequest vinculada
 */
async function ensureCanDeleteSector(sectorId: string): Promise<void> {
  const sector = await prisma.sector.findUnique({
    where: { id: sectorId },
    select: {
      id: true,
      name: true,
      isWarehouse: true,
      _count: {
        select: {
          users: true,
          transfersFrom: true,
          transfersTo: true,
          purchaseRequests: true,
        },
      },
    },
  });

  if (!sector) {
    throw new Error("Setor não encontrado");
  }

  if (sector.isWarehouse) {
    throw new Error(
      `O setor "${sector.name}" é o Almoxarifado (ponto 0) e não pode ser deletado`,
    );
  }

  if (sector._count.users > 0) {
    throw new Error(
      `Setor "${sector.name}" possui ${sector._count.users} usuário(s) vinculado(s). Não pode ser deletado.`,
    );
  }

  if (sector._count.transfersFrom > 0 || sector._count.transfersTo > 0) {
    throw new Error(
      `Setor "${sector.name}" possui remessas vinculadas. Não pode ser deletado.`,
    );
  }

  if (sector._count.purchaseRequests > 0) {
    throw new Error(
      `Setor "${sector.name}" possui pedidos vinculados. Não pode ser deletado.`,
    );
  }
}

export const sectorService = {
  /**
   * Criar setor (only MANAGER)
   * - Valida nome único (case-insensitive)
   * - Valida isWarehouse: só pode existir 1 true
   */
  async createSector(data: CreateSectorData): Promise<SectorResponse> {
    // 1. Normalizar nome
    const normalizedName = normalizeText(data.name);
    if (!normalizedName || normalizedName.length < 2) {
      throw new Error("Dados inválidos: nome deve ter pelo menos 2 caracteres");
    }
    if (normalizedName.length > 50) {
      throw new Error("Dados inválidos: nome deve ter no máximo 50 caracteres");
    }

    // 2. Checar duplicata (case-insensitive)
    const existing = await prisma.sector.findFirst({
      where: {
        name: { equals: normalizedName, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });
    if (existing) {
      throw new Error(`Setor "${normalizedName}" já existe`);
    }

    // 3. Validar isWarehouse único
    if (data.isWarehouse) {
      const warehouseCount = await countWarehouses();
      if (warehouseCount > 0) {
        throw new Error(
          "Já existe um setor com isWarehouse: true (Almoxarifado). Só pode existir 1.",
        );
      }
    }

    // 4. Criar
    const sector = await prisma.sector.create({
      data: {
        name: normalizedName,
        description: data.description ? normalizeText(data.description) : null,
        isWarehouse: data.isWarehouse ?? false,
        isActive: data.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            users: true,
            transfersFrom: true,
            transfersTo: true,
            purchaseRequests: true,
          },
        },
      },
    });

    return sector;
  },

  /**
   * Listar setores (STAFF + MANAGER)
   * Filtros: search, isWarehouse, isActive
   */
  async listSectors(filters?: SectorFilters): Promise<SectorsListResponse> {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters?.isWarehouse !== undefined) {
      where.isWarehouse = filters.isWarehouse;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const sectors = await prisma.sector.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            transfersFrom: true,
            transfersTo: true,
            purchaseRequests: true,
          },
        },
      },
      orderBy: [{ isWarehouse: "desc" }, { name: "asc" }], // Almoxarifado primeiro
    });

    return {
      sectors,
      total: sectors.length,
    };
  },

  /**
   * Buscar setor por ID (STAFF + MANAGER)
   */
  async getSectorById(sectorId: string): Promise<SectorResponse | null> {
    return prisma.sector.findUnique({
      where: { id: sectorId },
      include: {
        _count: {
          select: {
            users: true,
            transfersFrom: true,
            transfersTo: true,
            purchaseRequests: true,
          },
        },
      },
    });
  },

  /**
   * Atualizar setor (only MANAGER)
   * - isWarehouse é IMUTÁVEL (não pode ser alterado)
   * - Nome pode ser alterado (valida duplicata)
   */
  async updateSector(
    sectorId: string,
    data: UpdateSectorData,
  ): Promise<SectorResponse> {
    // 1. Buscar setor existente
    const existing = await prisma.sector.findUnique({
      where: { id: sectorId },
      select: { id: true, name: true, isWarehouse: true },
    });
    if (!existing) {
      throw new Error("Setor não encontrado");
    }

    // 2. Normalizar nome (se veio)
    const updateData: any = {};

    if (data.name !== undefined) {
      const normalizedName = normalizeText(data.name);
      if (!normalizedName || normalizedName.length < 2) {
        throw new Error(
          "Dados inválidos: nome deve ter pelo menos 2 caracteres",
        );
      }
      if (normalizedName.length > 50) {
        throw new Error(
          "Dados inválidos: nome deve ter no máximo 50 caracteres",
        );
      }

      // Checar duplicata (case-insensitive, excluindo o próprio)
      const duplicate = await prisma.sector.findFirst({
        where: {
          name: { equals: normalizedName, mode: "insensitive" },
          id: { not: sectorId },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new Error(`Setor "${normalizedName}" já existe`);
      }

      updateData.name = normalizedName;
    }

    if (data.description !== undefined) {
      updateData.description = data.description
        ? normalizeText(data.description)
        : null;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // 3. Atualizar
    const sector = await prisma.sector.update({
      where: { id: sectorId },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            transfersFrom: true,
            transfersTo: true,
            purchaseRequests: true,
          },
        },
      },
    });

    return sector;
  },

  /**
   * Deletar setor (only MANAGER)
   * - Bloqueia se isWarehouse: true
   * - Bloqueia se tiver users/transfers/purchaseRequests vinculados
   */
  async deleteSector(sectorId: string): Promise<void> {
    await ensureCanDeleteSector(sectorId);

    await prisma.sector.delete({
      where: { id: sectorId },
    });
  },

  /**
   * Listar setores para dropdowns (STAFF + MANAGER)
   * GET /admin/sectors/options
   * Shape: { label, value, isWarehouse }[]
   */
  async getSectorOptions(): Promise<SectorOption[]> {
    const sectors = await prisma.sector.findMany({
      where: { isActive: true }, // só ativos no dropdown
      orderBy: [{ isWarehouse: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isWarehouse: true,
      },
    });

    return sectors.map((s) => ({
      label: s.name,
      value: s.id,
      isWarehouse: s.isWarehouse,
    }));
  },

  /**
   * 🔹 NOVO — Fase 6
   * Retorna o ID do Almoxarifado (setor com isWarehouse: true).
   * Como isWarehouse é imutável, o valor é cacheado em memória.
   * Se não existir Almoxarifado, lança erro (configuração inválida).
   */
  async getAlmoxarifadoId(): Promise<string> {
    if (cachedAlmoxarifadoId) {
      return cachedAlmoxarifadoId;
    }

    const almoxarifado = await prisma.sector.findFirst({
      where: { isWarehouse: true },
      select: { id: true },
    });

    if (!almoxarifado) {
      throw new Error(
        "Almoxarifado não configurado. O sistema precisa de exatamente 1 setor com isWarehouse: true.",
      );
    }

    cachedAlmoxarifadoId = almoxarifado.id;
    return cachedAlmoxarifadoId;
  },
};
