// src/services/admin/movementService.ts
import { prisma } from "../../lib/prisma.js";
import {
  GlobalMovementFilters,
  GlobalMovementsListResponse,
} from "../../types/movement.types.js";

const movementInclude = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      imageUrl: true,
      priceInCents: true,
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  fromSector: { select: { id: true, name: true, isWarehouse: true } },
  toSector: { select: { id: true, name: true, isWarehouse: true } },
} as const;

export const movementService = {
  /**
   * List movements globally (preparatório pra /history da Fase 6.5)
   * GET /admin/movements
   * Filtros: type, status, createdById, productId, dateFrom, dateTo, search, page, limit, sortBy, sortOrder
   */
  async listMovements(
    filters?: GlobalMovementFilters,
  ): Promise<GlobalMovementsListResponse> {
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.createdById) {
      where.createdById = filters.createdById;
    }

    if (filters?.productId) {
      where.productId = filters.productId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    // 🔹 Search: por nome/SKU do produto ou reason
    if (filters?.search) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT m.id FROM "Movement" m
        INNER JOIN "Product" p ON p.id = m."productId"
        WHERE unaccent(p.name) ILIKE unaccent(${`%${filters.search}%`})
           OR unaccent(coalesce(p.sku, '')) ILIKE unaccent(${`%${filters.search}%`})
           OR unaccent(coalesce(m.reason, '')) ILIKE unaccent(${`%${filters.search}%`})
      `;
      const searchIds = rows.map((r) => r.id);
      where.id = { in: searchIds.length > 0 ? searchIds : ["__none__"] };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = filters?.sortBy || "createdAt";
    const sortOrder = filters?.sortOrder || "desc";

    const [movements, total] = await Promise.all([
      prisma.movement.findMany({
        where,
        include: movementInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.movement.count({ where }),
    ]);

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
};
