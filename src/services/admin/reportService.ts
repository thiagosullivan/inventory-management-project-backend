// src/services/admin/reportService.ts
import { prisma } from "../../lib/prisma.js";
import { sectorService } from "./sectorService.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  MovementStatus,
  MovementType,
  PurchaseRequestStatus as PrismaPurchaseRequestStatus,
  TransferStatus as PrismaTransferStatus,
} from "../../generated/prisma/client.js";
import {
  ConsumptionFilters,
  ConsumptionGlobalResponse,
  ConsumptionGlobalSectorRow,
  ConsumptionGlobalSummary,
  ConsumptionGlobalTopProduct,
  ConsumptionMonthlyBreakdownPoint,
  ConsumptionSectorProductRow,
  ConsumptionSectorResponse,
  ConsumptionSectorSummary,
  ManualOutputFilters,
  ManualOutputMovementRow,
  ManualOutputResponse,
  ManualOutputSectorSummary,
  ManualOutputSummary,
  ReportPeriod,
  RequestReportFilters,
  RequestReportItemRow,
  RequestReportResponse,
  RequestReportRow,
  RequestReportSummary,
} from "../../types/report.types.js";

// ============================================================
// HELPERS
// ============================================================

const ALL_REQUEST_STATUSES = Object.values(PrismaPurchaseRequestStatus);

/**
 * 🔹 Garante que o user é STAFF do Almoxarifado ou MANAGER.
 */
async function ensureCanViewReports(
  userSectorId: string,
  userRole: Role,
): Promise<string> {
  const almoxarifadoId = await sectorService.getAlmoxarifadoId();
  const isManager = userRole === Role.MANAGER;
  const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

  if (!isManager && !isAlmoxarifadoStaff) {
    throw new Error(
      "Apenas STAFF do Almoxarifado ou MANAGER podem acessar relatórios",
    );
  }

  return almoxarifadoId;
}

/**
 * 🔹 Percentual 0–100, 1 casa decimal. Divisor 0 → 0.
 */
function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * 🔹 Default R1/R2b: mês corrente.
 */
function defaultCurrentMonthRange(): ReportPeriod {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { dateFrom: from, dateTo: to };
}

/**
 * 🔹 Default R2: últimos 6 meses (inclui o mês atual).
 */
function defaultLastSixMonthsRange(): ReportPeriod {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
  const to = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { dateFrom: from, dateTo: to };
}

function resolvePeriod(
  dateFrom?: string,
  dateTo?: string,
  defaults: ReportPeriod = defaultCurrentMonthRange(),
): ReportPeriod {
  return {
    dateFrom: dateFrom ? new Date(dateFrom) : defaults.dateFrom,
    dateTo: dateTo ? new Date(dateTo) : defaults.dateTo,
  };
}

/**
 * 🔹 Lista de meses "YYYY-MM" cobertos pelo range.
 * Compara por (ano*12 + mês) — imune a boundaries de fuso/DST.
 */
function monthsBetween(from: Date, to: Date): string[] {
  const months: string[] = [];
  const fromIdx = from.getUTCFullYear() * 12 + from.getUTCMonth();
  const toIdx = to.getUTCFullYear() * 12 + to.getUTCMonth();
  for (let idx = fromIdx; idx <= toIdx; idx++) {
    const year = Math.floor(idx / 12);
    const month = idx % 12;
    months.push(`${year}-${String(month + 1).padStart(2, "0")}`);
  }
  return months;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 🔹 Regra de prioridade (R2): ≥80% dos meses OU consumedQty >= threshold.
 */
function isPriority(
  monthsWithConsumption: number,
  monthsInRange: number,
  consumedQty: number,
  priorityThreshold: number,
): boolean {
  if (monthsInRange > 0 && monthsWithConsumption / monthsInRange >= 0.8) {
    return true;
  }
  return consumedQty >= priorityThreshold;
}

function clampLimit(value: number | undefined, fallback: number): number {
  const n = value ?? fallback;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 100);
}

// ============================================================
// R1 — INCLUDE
// ============================================================

const requestReportInclude = {
  sector: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      productId: true,
      quantity: true,
      product: { select: { name: true, sku: true } },
    },
  },
  transfers: {
    where: { status: PrismaTransferStatus.CONCLUIDO },
    select: {
      items: { select: { productId: true, quantity: true } },
    },
  },
} as const;

// ============================================================
// TIPOS INTERNOS (agregação R2)
// ============================================================

interface ConsumptionProductAgg {
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  consumedQty: number;
  consumedValueInCents: number;
  monthsWithConsumption: Set<string>;
}

interface ConsumptionSectorAgg {
  sectorId: string;
  sectorName: string;
  products: Map<string, ConsumptionProductAgg>;
  totalConsumedQty: number;
  totalConsumedValueInCents: number;
}

// ============================================================
// SERVICE
// ============================================================

export const reportService = {
  // ==========================================================
  // R1 — GET /admin/reports/requests
  // ==========================================================
  async getRequestReport(
    filters: RequestReportFilters | undefined,
    userSectorId: string,
    userRole: Role,
  ): Promise<RequestReportResponse> {
    await ensureCanViewReports(userSectorId, userRole);

    const period = resolvePeriod(
      filters?.dateFrom,
      filters?.dateTo,
      defaultCurrentMonthRange(),
    );

    const page = Math.max(filters?.page ?? 1, 1);
    const limit = clampLimit(filters?.limit, 20);
    const skip = (page - 1) * limit;
    const sortBy = filters?.sortBy ?? "createdAt";
    const sortOrder = filters?.sortOrder ?? "desc";

    // ---- WHERE ----
    const where: any = {
      createdAt: { gte: period.dateFrom, lte: period.dateTo },
    };
    if (filters?.sectorId) where.sectorId = filters.sectorId;
    if (filters?.status) where.status = filters.status;

    // ---- ORDER BY ----
    const orderBy: any =
      sortBy === "sectorName"
        ? { sector: { name: sortOrder } }
        : { [sortBy]: sortOrder };

    // ---- QUERIES ----
    const [rawRequests, total, summaryRaw] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: requestReportInclude,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.purchaseRequest.count({ where }),
      prisma.purchaseRequest.findMany({
        where,
        select: {
          status: true,
          items: { select: { quantity: true } },
          transfers: {
            where: { status: PrismaTransferStatus.CONCLUIDO },
            select: { items: { select: { quantity: true } } },
          },
        },
      }),
    ]);

    // ---- ROWS ----
    const rows: RequestReportRow[] = rawRequests.map((req) => {
      const sentByProduct = new Map<string, number>();
      for (const tr of req.transfers) {
        for (const it of tr.items) {
          sentByProduct.set(
            it.productId,
            (sentByProduct.get(it.productId) ?? 0) + it.quantity,
          );
        }
      }

      const items: RequestReportItemRow[] = req.items.map((it) => {
        const sentQty = sentByProduct.get(it.productId) ?? 0;
        return {
          productId: it.productId,
          productName: it.product.name,
          productSku: it.product.sku,
          requestedQty: it.quantity,
          sentQty,
          fulfillmentPct: pct(sentQty, it.quantity),
        };
      });

      const requestedQty = items.reduce((s, i) => s + i.requestedQty, 0);
      const sentQty = items.reduce((s, i) => s + i.sentQty, 0);

      return {
        id: req.id,
        sectorId: req.sector.id,
        sectorName: req.sector.name,
        status: req.status,
        createdAt: req.createdAt,
        finalizedAt: req.finalizedAt,
        createdById: req.createdBy.id,
        createdByName: req.createdBy.name,
        totals: {
          requestedQty,
          sentQty,
          fulfillmentPct: pct(sentQty, requestedQty),
        },
        items,
      };
    });

    // ---- SUMMARY ----
    const byStatus: Record<string, number> = {};
    for (const s of ALL_REQUEST_STATUSES) byStatus[s] = 0;

    let totalRequestedQty = 0;
    let totalSentQty = 0;
    for (const r of summaryRaw) {
      byStatus[r.status] += 1;
      for (const it of r.items) totalRequestedQty += it.quantity;
      for (const tr of r.transfers) {
        for (const it of tr.items) totalSentQty += it.quantity;
      }
    }

    const summary: RequestReportSummary = {
      totalRequests: summaryRaw.length,
      byStatus: byStatus as RequestReportSummary["byStatus"],
      totalRequestedQty,
      totalSentQty,
      overallFulfillmentPct: pct(totalSentQty, totalRequestedQty),
    };

    return {
      period,
      requests: rows,
      summary,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  },

  // ==========================================================
  // R2 — GET /admin/reports/consumption (GLOBAL)
  // ==========================================================
  async getConsumptionGlobal(
    filters: ConsumptionFilters | undefined,
    userSectorId: string,
    userRole: Role,
  ): Promise<ConsumptionGlobalResponse> {
    await ensureCanViewReports(userSectorId, userRole);

    const period = resolvePeriod(
      filters?.dateFrom,
      filters?.dateTo,
      defaultLastSixMonthsRange(),
    );
    const priorityThreshold = filters?.priorityThreshold ?? 50;
    const limit = clampLimit(filters?.limit, 10);
    const monthsInRange = monthsBetween(period.dateFrom, period.dateTo).length;

    // ---- Transfers CONCLUIDO no range (confirmedAt) ----
    const transfers = await prisma.transfer.findMany({
      where: {
        status: PrismaTransferStatus.CONCLUIDO,
        confirmedAt: { gte: period.dateFrom, lte: period.dateTo },
      },
      select: {
        id: true,
        confirmedAt: true,
        toSectorId: true,
        toSector: { select: { id: true, name: true } },
        items: {
          select: {
            productId: true,
            quantity: true,
            product: {
              select: { id: true, name: true, sku: true, imageUrl: true },
            },
          },
        },
      },
    });

    // ---- Movements SAIDA correspondentes (unitPriceInCents) ----
    const transferIds = transfers.map((t) => t.id);
    const unitPriceMap = new Map<string, number | null>();
    if (transferIds.length > 0) {
      const movements = await prisma.movement.findMany({
        where: {
          transferId: { in: transferIds },
          type: MovementType.SAIDA,
          status: MovementStatus.CONCLUIDO,
        },
        select: { transferId: true, productId: true, unitPriceInCents: true },
      });
      for (const m of movements) {
        if (!m.transferId) continue;
        unitPriceMap.set(`${m.transferId}::${m.productId}`, m.unitPriceInCents);
      }
    }

    // ---- Agregação por setor + global ----
    const bySectorMap = new Map<string, ConsumptionSectorAgg>();
    const globalProductMap = new Map<string, ConsumptionProductAgg>();

    for (const tr of transfers) {
      if (!tr.confirmedAt) continue;
      const mKey = monthKey(tr.confirmedAt);

      const sectorKey = tr.toSector.id;
      if (!bySectorMap.has(sectorKey)) {
        bySectorMap.set(sectorKey, {
          sectorId: tr.toSector.id,
          sectorName: tr.toSector.name,
          products: new Map(),
          totalConsumedQty: 0,
          totalConsumedValueInCents: 0,
        });
      }
      const sectorAgg = bySectorMap.get(sectorKey)!;

      for (const it of tr.items) {
        const unitPrice = unitPriceMap.get(`${tr.id}::${it.productId}`) ?? null;
        const valueInCents = unitPrice ? it.quantity * unitPrice : 0;

        // Por setor
        let sp = sectorAgg.products.get(it.productId);
        if (!sp) {
          sp = {
            productId: it.productId,
            productName: it.product.name,
            productSku: it.product.sku,
            productImageUrl: it.product.imageUrl,
            consumedQty: 0,
            consumedValueInCents: 0,
            monthsWithConsumption: new Set(),
          };
          sectorAgg.products.set(it.productId, sp);
        }
        sp.consumedQty += it.quantity;
        sp.consumedValueInCents += valueInCents;
        sp.monthsWithConsumption.add(mKey);

        sectorAgg.totalConsumedQty += it.quantity;
        sectorAgg.totalConsumedValueInCents += valueInCents;

        // Global
        let gp = globalProductMap.get(it.productId);
        if (!gp) {
          gp = {
            productId: it.productId,
            productName: it.product.name,
            productSku: it.product.sku,
            productImageUrl: it.product.imageUrl,
            consumedQty: 0,
            consumedValueInCents: 0,
            monthsWithConsumption: new Set(),
          };
          globalProductMap.set(it.productId, gp);
        }
        gp.consumedQty += it.quantity;
        gp.consumedValueInCents += valueInCents;
        gp.monthsWithConsumption.add(mKey);
      }
    }

    // ---- bySector[] ----
    const bySector: ConsumptionGlobalSectorRow[] = [];
    for (const sectorAgg of bySectorMap.values()) {
      const topProducts: ConsumptionGlobalTopProduct[] = Array.from(
        sectorAgg.products.values(),
      )
        .map((p) => {
          const monthsWithConsumption = p.monthsWithConsumption.size;
          return {
            productId: p.productId,
            productName: p.productName,
            productSku: p.productSku,
            productImageUrl: p.productImageUrl,
            consumedQty: p.consumedQty,
            consumedValueInCents: p.consumedValueInCents,
            monthsWithConsumption,
            monthsInRange,
            priority: isPriority(
              monthsWithConsumption,
              monthsInRange,
              p.consumedQty,
              priorityThreshold,
            ),
          };
        })
        .sort((a, b) => b.consumedQty - a.consumedQty)
        .slice(0, limit);

      bySector.push({
        sectorId: sectorAgg.sectorId,
        sectorName: sectorAgg.sectorName,
        totalConsumedQty: sectorAgg.totalConsumedQty,
        totalConsumedValueInCents: sectorAgg.totalConsumedValueInCents,
        productsCount: sectorAgg.products.size,
        topProducts,
      });
    }
    bySector.sort((a, b) => b.totalConsumedQty - a.totalConsumedQty);

    // ---- overallTopProducts[] ----
    const overallTopProducts: ConsumptionGlobalTopProduct[] = Array.from(
      globalProductMap.values(),
    )
      .map((p) => {
        const monthsWithConsumption = p.monthsWithConsumption.size;
        return {
          productId: p.productId,
          productName: p.productName,
          productSku: p.productSku,
          productImageUrl: p.productImageUrl,
          consumedQty: p.consumedQty,
          consumedValueInCents: p.consumedValueInCents,
          monthsWithConsumption,
          monthsInRange,
          priority: isPriority(
            monthsWithConsumption,
            monthsInRange,
            p.consumedQty,
            priorityThreshold,
          ),
        };
      })
      .sort((a, b) => b.consumedQty - a.consumedQty)
      .slice(0, limit);

    // ---- summary ----
    let totalConsumedQty = 0;
    let totalConsumedValueInCents = 0;
    for (const s of bySector) {
      totalConsumedQty += s.totalConsumedQty;
      totalConsumedValueInCents += s.totalConsumedValueInCents;
    }
    // 🔹 ponto 3: produtos DISTINTOS com prioridade em qualquer setor
    let priorityProductsCount = 0;
    for (const gp of globalProductMap.values()) {
      if (
        isPriority(
          gp.monthsWithConsumption.size,
          monthsInRange,
          gp.consumedQty,
          priorityThreshold,
        )
      ) {
        priorityProductsCount += 1;
      }
    }

    const summary: ConsumptionGlobalSummary = {
      totalConsumedQty,
      totalConsumedValueInCents,
      totalSectors: bySector.length,
      totalProducts: globalProductMap.size,
      monthsInRange,
      priorityProductsCount,
    };

    return { period, summary, bySector, overallTopProducts };
  },

  // ==========================================================
  // R2 — GET /admin/reports/consumption/:sectorId
  // ==========================================================
  async getConsumptionBySector(
    sectorId: string,
    filters: ConsumptionFilters | undefined,
    userSectorId: string,
    userRole: Role,
  ): Promise<ConsumptionSectorResponse> {
    await ensureCanViewReports(userSectorId, userRole);

    const sector = await prisma.sector.findUnique({
      where: { id: sectorId },
      select: { id: true, name: true },
    });
    if (!sector) throw new Error("Setor não encontrado");

    const period = resolvePeriod(
      filters?.dateFrom,
      filters?.dateTo,
      defaultLastSixMonthsRange(),
    );
    const priorityThreshold = filters?.priorityThreshold ?? 50;
    const limit = clampLimit(filters?.limit, 10);
    const monthList = monthsBetween(period.dateFrom, period.dateTo);
    const monthsInRange = monthList.length;

    const transfers = await prisma.transfer.findMany({
      where: {
        status: PrismaTransferStatus.CONCLUIDO,
        toSectorId: sectorId,
        confirmedAt: { gte: period.dateFrom, lte: period.dateTo },
      },
      select: {
        id: true,
        confirmedAt: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            product: {
              select: { id: true, name: true, sku: true, imageUrl: true },
            },
          },
        },
      },
    });

    const transferIds = transfers.map((t) => t.id);
    const unitPriceMap = new Map<string, number | null>();
    if (transferIds.length > 0) {
      const movements = await prisma.movement.findMany({
        where: {
          transferId: { in: transferIds },
          type: MovementType.SAIDA,
          status: MovementStatus.CONCLUIDO,
        },
        select: { transferId: true, productId: true, unitPriceInCents: true },
      });
      for (const m of movements) {
        if (!m.transferId) continue;
        unitPriceMap.set(`${m.transferId}::${m.productId}`, m.unitPriceInCents);
      }
    }

    // Agregação por produto
    interface SectorProductAgg extends ConsumptionProductAgg {
      monthly: Map<string, ConsumptionMonthlyBreakdownPoint>;
    }
    const productMap = new Map<string, SectorProductAgg>();

    for (const tr of transfers) {
      if (!tr.confirmedAt) continue;
      const mKey = monthKey(tr.confirmedAt);

      for (const it of tr.items) {
        const unitPrice = unitPriceMap.get(`${tr.id}::${it.productId}`) ?? null;
        const valueInCents = unitPrice ? it.quantity * unitPrice : 0;

        let p = productMap.get(it.productId);
        if (!p) {
          p = {
            productId: it.productId,
            productName: it.product.name,
            productSku: it.product.sku,
            productImageUrl: it.product.imageUrl,
            consumedQty: 0,
            consumedValueInCents: 0,
            monthsWithConsumption: new Set(),
            monthly: new Map(),
          };
          productMap.set(it.productId, p);
        }
        p.consumedQty += it.quantity;
        p.consumedValueInCents += valueInCents;
        p.monthsWithConsumption.add(mKey);

        let point = p.monthly.get(mKey);
        if (!point) {
          point = { month: mKey, consumedQty: 0, consumedValueInCents: 0 };
          p.monthly.set(mKey, point);
        }
        point.consumedQty += it.quantity;
        point.consumedValueInCents += valueInCents;
      }
    }

    // 🔹 ponto 4: summary soma sobre o productMap INTEIRO
    let totalConsumedQty = 0;
    let totalConsumedValueInCents = 0;
    let priorityProductsCount = 0;
    for (const p of productMap.values()) {
      totalConsumedQty += p.consumedQty;
      totalConsumedValueInCents += p.consumedValueInCents;
      if (
        isPriority(
          p.monthsWithConsumption.size,
          monthsInRange,
          p.consumedQty,
          priorityThreshold,
        )
      ) {
        priorityProductsCount += 1;
      }
    }

    // products[] — top N para exibição
    const products: ConsumptionSectorProductRow[] = Array.from(
      productMap.values(),
    )
      .map((p) => {
        const monthsWithConsumption = p.monthsWithConsumption.size;
        return {
          productId: p.productId,
          productName: p.productName,
          productSku: p.productSku,
          productImageUrl: p.productImageUrl,
          consumedQty: p.consumedQty,
          consumedValueInCents: p.consumedValueInCents,
          monthsWithConsumption,
          monthsInRange,
          priority: isPriority(
            monthsWithConsumption,
            monthsInRange,
            p.consumedQty,
            priorityThreshold,
          ),
          monthlyBreakdown: monthList.map((m) => {
            const point = p.monthly.get(m);
            return point
              ? { ...point }
              : { month: m, consumedQty: 0, consumedValueInCents: 0 };
          }),
        };
      })
      .sort((a, b) => b.consumedQty - a.consumedQty)
      .slice(0, limit);

    const summary: ConsumptionSectorSummary = {
      totalConsumedQty,
      totalConsumedValueInCents,
      productsCount: productMap.size,
      monthsInRange,
      priorityProductsCount,
    };

    return { sector, period, summary, products };
  },

  // ==========================================================
  // R2b — GET /admin/reports/manual-output
  // ==========================================================
  async getManualOutput(
    filters: ManualOutputFilters | undefined,
    userSectorId: string,
    userRole: Role,
  ): Promise<ManualOutputResponse> {
    await ensureCanViewReports(userSectorId, userRole);

    const period = resolvePeriod(
      filters?.dateFrom,
      filters?.dateTo,
      defaultCurrentMonthRange(),
    );

    const page = Math.max(filters?.page ?? 1, 1);
    const limit = clampLimit(filters?.limit, 20);
    const skip = (page - 1) * limit;

    // ---- WHERE ----
    const where: any = {
      type: MovementType.SAIDA,
      transferId: { equals: null },
      createdAt: { gte: period.dateFrom, lte: period.dateTo },
    };
    if (filters?.sectorId) where.fromSectorId = filters.sectorId;
    if (filters?.productId) where.productId = filters.productId;

    // ---- QUERIES ----
    const [movements, total, aggRows] = await Promise.all([
      prisma.movement.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          productId: true,
          quantity: true,
          reason: true,
          fromSectorId: true,
          fromSector: { select: { id: true, name: true } },
          createdById: true,
          createdBy: { select: { id: true, name: true } },
          unitPriceInCents: true,
          product: {
            select: { id: true, name: true, sku: true, imageUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.movement.count({ where }),
      prisma.movement.findMany({
        where,
        select: {
          quantity: true,
          unitPriceInCents: true,
          fromSectorId: true,
          fromSector: { select: { id: true, name: true } },
        },
      }),
    ]);

    // ---- ROWS ----
    const rows: ManualOutputMovementRow[] = movements.map((m) => {
      const unit = m.unitPriceInCents ?? 0;
      return {
        id: m.id,
        createdAt: m.createdAt,
        productId: m.productId,
        productName: m.product.name,
        productSku: m.product.sku,
        productImageUrl: m.product.imageUrl,
        quantity: m.quantity,
        reason: m.reason,
        fromSectorId: m.fromSectorId,
        fromSectorName: m.fromSector?.name ?? null,
        createdById: m.createdById,
        createdByName: m.createdBy.name,
        unitPriceInCents: m.unitPriceInCents,
        totalValueInCents: Math.abs(m.quantity) * unit,
      };
    });

    // ---- SUMMARY ----
    let totalMovements = 0;
    let totalQty = 0;
    let totalValueInCents = 0;
    const bySectorMap = new Map<string, ManualOutputSectorSummary>();

    for (const r of aggRows) {
      totalMovements += 1;
      const qtyAbs = Math.abs(r.quantity);
      const value = qtyAbs * (r.unitPriceInCents ?? 0);
      totalQty += qtyAbs;
      totalValueInCents += value;

      if (r.fromSector) {
        const key = r.fromSector.id;
        if (!bySectorMap.has(key)) {
          bySectorMap.set(key, {
            sectorId: r.fromSector.id,
            sectorName: r.fromSector.name,
            totalMovements: 0,
            totalQty: 0,
            totalValueInCents: 0,
          });
        }
        const s = bySectorMap.get(key)!;
        s.totalMovements += 1;
        s.totalQty += qtyAbs;
        s.totalValueInCents += value;
      }
    }

    const bySector = Array.from(bySectorMap.values()).sort(
      (a, b) => b.totalQty - a.totalQty,
    );

    const summary: ManualOutputSummary = {
      totalMovements,
      totalQty,
      totalValueInCents,
      bySector,
    };

    return {
      period,
      movements: rows,
      summary,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  },
};
