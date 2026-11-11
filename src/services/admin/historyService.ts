// src/services/admin/historyService.ts
import { prisma } from "../../lib/prisma.js";
import { sectorService } from "./sectorService.js";
import { Role } from "../../generated/prisma/enums.js";
import { TransferStatus as PrismaTransferStatus } from "../../generated/prisma/client.js";
import {
  HistoryEvent,
  HistoryFilters,
  HistoryListResponse,
  HistoryMovementRef,
  HistoryTransferRef,
} from "../../types/history.types.js";

// ============================================================
// HELPERS
// ============================================================

/**
 * 🔹 true se o user pode ver tudo (MANAGER ou STAFF do Almox).
 * STAFF de setor comum vê só Movements/Transfers onde seu setor participa.
 */
async function canViewEverything(
  userSectorId: string,
  userRole: Role,
): Promise<boolean> {
  if (userRole === Role.MANAGER) return true;
  const almoxarifadoId = await sectorService.getAlmoxarifadoId();
  return userSectorId === almoxarifadoId;
}

/**
 * 🔹 Where de Movement (visibilidade + filtros + search).
 */
async function buildMovementWhere(
  filters: HistoryFilters | undefined,
  canViewAll: boolean,
  userSectorId: string,
): Promise<any> {
  const where: any = {};

  if (!canViewAll) {
    where.OR = [{ fromSectorId: userSectorId }, { toSectorId: userSectorId }];
  }

  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;
  if (filters?.createdById) where.createdById = filters.createdById;
  if (filters?.productId) where.productId = filters.productId;

  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  // search: só Movements (join unaccent em Product + reason)
  if (filters?.search) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT m.id FROM "Movement" m
      INNER JOIN "Product" p ON p.id = m."productId"
      WHERE unaccent(p.name) ILIKE unaccent(${`%${filters.search}%`})
         OR unaccent(coalesce(p.sku, '')) ILIKE unaccent(${`%${filters.search}%`})
         OR unaccent(coalesce(m.reason, '')) ILIKE unaccent(${`%${filters.search}%`})
    `;
    const ids = rows.map((r) => r.id);
    where.id = { in: ids.length > 0 ? ids : ["__none__"] };
  }

  return where;
}

/**
 * 🔹 Where de Transfer (visibilidade + filtros).
 * - status: só aplica se existir em TransferStatus; senão exclui Transfers.
 * - productId: via items.some (mantém todos os items no retorno — ponto 6).
 * - dateFrom/dateTo: em Transfer.createdAt (ponto 7).
 */
function buildTransferWhere(
  filters: HistoryFilters | undefined,
  canViewAll: boolean,
  userSectorId: string,
): { where: any; include: boolean } {
  const where: any = {};

  if (!canViewAll) {
    where.OR = [{ fromSectorId: userSectorId }, { toSectorId: userSectorId }];
  }

  if (filters?.createdById) where.createdById = filters.createdById;
  if (filters?.productId) {
    where.items = { some: { productId: filters.productId } };
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  if (filters?.status) {
    const validTransferStatuses = Object.values(PrismaTransferStatus);
    if (validTransferStatuses.includes(filters.status as any)) {
      where.status = filters.status;
    } else {
      return { where, include: false };
    }
  }

  return { where, include: true };
}

// ============================================================
// INCLUDES
// ============================================================

const movementInclude = {
  product: { select: { id: true, name: true, sku: true, imageUrl: true } },
  createdBy: { select: { id: true, name: true } },
  fromSector: { select: { id: true, name: true, isWarehouse: true } },
  toSector: { select: { id: true, name: true, isWarehouse: true } },
} as const;

const transferInclude = {
  fromSector: { select: { id: true, name: true, isWarehouse: true } },
  toSector: { select: { id: true, name: true, isWarehouse: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      productId: true,
      quantity: true,
      product: { select: { id: true, name: true, sku: true, imageUrl: true } },
    },
  },
  _count: { select: { items: true } },
} as const;

// ============================================================
// MAPPERS
// ============================================================

function toMovementRef(m: any): HistoryMovementRef {
  return {
    id: m.id,
    type: m.type,
    status: m.status,
    quantity: m.quantity,
    reason: m.reason,
    unitPriceInCents: m.unitPriceInCents,
    createdAt: m.createdAt,
    product: {
      id: m.product.id,
      name: m.product.name,
      sku: m.product.sku,
      imageUrl: m.product.imageUrl,
    },
    createdBy: { id: m.createdBy.id, name: m.createdBy.name },
    fromSector: m.fromSector,
    toSector: m.toSector,
  };
}

function toTransferRef(t: any): HistoryTransferRef {
  return {
    id: t.id,
    status: t.status,
    createdAt: t.createdAt,
    confirmedAt: t.confirmedAt,
    refusedAt: t.refusedAt,
    cancelledAt: t.cancelledAt,
    reason: t.reason,
    refusalReason: t.refusalReason,
    cancelReason: t.cancelReason,
    fromSector: t.fromSector,
    toSector: t.toSector,
    createdBy: { id: t.createdBy.id, name: t.createdBy.name },
    items: t.items.map((it: any) => ({
      productId: it.productId,
      quantity: it.quantity,
      product: {
        id: it.product.id,
        name: it.product.name,
        sku: it.product.sku,
        imageUrl: it.product.imageUrl,
      },
    })),
    _count: t._count,
  };
}

// ============================================================
// SERVICE
// ============================================================

export const historyService = {
  /**
   * 🔹 GET /admin/history
   * - includeTransfers=true (default): agrupa por transferId
   * - includeTransfers=false: lista bruta de Movements
   */
  async listHistory(
    filters: HistoryFilters | undefined,
    userSectorId: string,
    userRole: Role,
  ): Promise<HistoryListResponse> {
    const page = Math.max(filters?.page ?? 1, 1);
    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const sortOrder = filters?.sortOrder ?? "desc";
    const includeTransfers = filters?.includeTransfers ?? true;

    const canViewAll = await canViewEverything(userSectorId, userRole);

    // 🔹 ponto 2: take com margem, sem loop
    const movementTake = (page + 1) * limit * 3;

    // ---- Movements ----
    const movementWhere = await buildMovementWhere(
      filters,
      canViewAll,
      userSectorId,
    );

    const [rawMovements, totalMovements, totalMovementsWithoutTransfer] =
      await Promise.all([
        prisma.movement.findMany({
          where: movementWhere,
          include: movementInclude,
          orderBy: { createdAt: sortOrder },
          take: movementTake,
        }),
        prisma.movement.count({ where: movementWhere }),
        prisma.movement.count({
          where: { ...movementWhere, transferId: { equals: null } },
        }),
      ]);

    // ---- Transfers (só quando includeTransfers=true) ----
    let rawTransfers: any[] = [];
    let totalTransfers = 0;

    if (includeTransfers) {
      const { where: transferWhere, include } = buildTransferWhere(
        filters,
        canViewAll,
        userSectorId,
      );
      if (include) {
        [rawTransfers, totalTransfers] = await Promise.all([
          prisma.transfer.findMany({
            where: transferWhere,
            include: transferInclude,
            orderBy: { createdAt: "desc" },
            take: movementTake,
          }),
          prisma.transfer.count({ where: transferWhere }),
        ]);
      }
    }

    // ---- Montar eventos ----
    const events: HistoryEvent[] = [];

    if (includeTransfers) {
      const transferIds = new Set(rawTransfers.map((t) => t.id));

      const movementsByTransferId = new Map<string, HistoryMovementRef[]>();
      for (const m of rawMovements) {
        if (m.transferId && transferIds.has(m.transferId)) {
          const arr = movementsByTransferId.get(m.transferId) ?? [];
          arr.push(toMovementRef(m));
          movementsByTransferId.set(m.transferId, arr);
        }
      }

      for (const t of rawTransfers) {
        events.push({
          eventType: "TRANSFER",
          createdAt: t.createdAt,
          transfer: toTransferRef(t),
          movements: movementsByTransferId.get(t.id) ?? [],
        });
      }

      for (const m of rawMovements) {
        if (!m.transferId) {
          events.push({
            eventType: "MOVEMENT",
            createdAt: m.createdAt,
            movement: toMovementRef(m),
          });
        }
      }
    } else {
      for (const m of rawMovements) {
        events.push({
          eventType: "MOVEMENT",
          createdAt: m.createdAt,
          movement: toMovementRef(m),
        });
      }
    }

    // ---- Merge ordenado por createdAt ----
    events.sort((a, b) => {
      const ta = a.createdAt.getTime();
      const tb = b.createdAt.getTime();
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });

    // ---- Paginar ----
    const paged = events.slice(skip, skip + limit);

    // 🔹 ponto 1: total honesto (Movements SEM transferId + Transfers)
    const total = includeTransfers
      ? totalMovementsWithoutTransfer + totalTransfers
      : totalMovements;

    return {
      events: paged,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  },
};
