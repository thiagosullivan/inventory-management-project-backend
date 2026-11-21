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
 * 🔹 _count padrão usado em todas as respostas de setor.
 *    Fase 7.7 — movementsFrom/To adicionados (bloqueiam delete).
 */
const SECTOR_COUNT_SELECT = {
  users: true,
  transfersFrom: true,
  transfersTo: true,
  purchaseRequests: true,
  movementsFrom: true,
  movementsTo: true,
} as const;

/**
 * 🔹 Checa se o setor pode ser deletado:
 * - Não pode ser o Almoxarifado (isWarehouse: true)
 * - Não pode ter usuários vinculados
 * - Não pode ter Transfer (from/to) vinculada
 * - Não pode ter PurchaseRequest vinculada
 * - Não pode ter Movement (from/to) vinculada
 */
async function ensureCanDeleteSector(sectorId: string): Promise<void> {
  const sector = await prisma.sector.findUnique({
    where: { id: sectorId },
    select: {
      id: true,
      name: true,
      isWarehouse: true,
      _count: { select: SECTOR_COUNT_SELECT },
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

  // 🔹 Fase 7.7 — movimentações (from/to) também bloqueiam
  if (sector._count.movementsFrom > 0 || sector._count.movementsTo > 0) {
    throw new Error(
      `Setor "${sector.name}" possui movimentações vinculadas. Não pode ser deletado.`,
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
    const normalizedName = normalizeText(data.name);
    if (!normalizedName || normalizedName.length < 2) {
      throw new Error("Dados inválidos: nome deve ter pelo menos 2 caracteres");
    }
    if (normalizedName.length > 50) {
      throw new Error("Dados inválidos: nome deve ter no máximo 50 caracteres");
    }

    const existing = await prisma.sector.findFirst({
      where: {
        name: { equals: normalizedName, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });
    if (existing) {
      throw new Error(`Setor "${normalizedName}" já existe`);
    }

    if (data.isWarehouse) {
      const warehouseCount = await countWarehouses();
      if (warehouseCount > 0) {
        throw new Error(
          "Já existe um setor com isWarehouse: true (Almoxarifado). Só pode existir 1.",
        );
      }
    }

    const sector = await prisma.sector.create({
      data: {
        name: normalizedName,
        description: data.description ? normalizeText(data.description) : null,
        isWarehouse: data.isWarehouse ?? false,
        isActive: data.isActive ?? true,
      },
      include: {
        _count: { select: SECTOR_COUNT_SELECT },
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
        _count: { select: SECTOR_COUNT_SELECT },
      },
      orderBy: [{ isWarehouse: "desc" }, { name: "asc" }],
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
        _count: { select: SECTOR_COUNT_SELECT },
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
    const existing = await prisma.sector.findUnique({
      where: { id: sectorId },
      select: { id: true, name: true, isWarehouse: true },
    });
    if (!existing) {
      throw new Error("Setor não encontrado");
    }

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

    const sector = await prisma.sector.update({
      where: { id: sectorId },
      data: updateData,
      include: {
        _count: { select: SECTOR_COUNT_SELECT },
      },
    });

    return sector;
  },

  /**
   * Deletar setor (only MANAGER)
   * - Bloqueia se isWarehouse: true
   * - Bloqueia se tiver users/transfers/purchaseRequests/movements vinculados
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
   * Shape: { label, value, isWarehouse, isActive }[]
   *
   * 🔹 Fase 7.7 — NÃO filtra isActive (o front decide onde desabilitar).
   *    Setores inativos precisam aparecer em filtros históricos e como
   *    item desabilitado em selects de criação/edição.
   */
  async getSectorOptions(): Promise<SectorOption[]> {
    const sectors = await prisma.sector.findMany({
      orderBy: [{ isWarehouse: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isWarehouse: true,
        isActive: true,
      },
    });

    return sectors.map((s) => ({
      label: s.name,
      value: s.id,
      isWarehouse: s.isWarehouse,
      isActive: s.isActive,
    }));
  },

  /**
   * Retorna o ID do Almoxarifado (setor com isWarehouse: true).
   * Como isWarehouse é imutável, o valor é cacheado em memória.
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