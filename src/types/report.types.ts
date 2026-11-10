// src/types/report.types.ts
import {
  MovementType,
  PurchaseRequestStatus,
  TransferStatus,
} from "../generated/prisma/enums";

// Enums auxiliares (espelho)

export type ReportSortOrder = "asc" | "desc";

// Filtros

// R1 — GET /admin/reports/requests
export interface RequestReportFilters {
  dateFrom?: string; // ISO; default = início do mês corrente
  dateTo?: string; // ISO; default = fim do mês corrente
  sectorId?: string;
  status?: PurchaseRequestStatus; // default: todos
  page?: number; // default 1
  limit?: number; // default 20, max 100
  sortBy?: "createdAt" | "finalizedAt" | "sectorName"; // default createdAt
  sortOrder?: ReportSortOrder; // default desc
}

// R2 — GET /admin/reports/consumption (global + /:sectorId)
export interface ConsumptionFilters {
  dateFrom?: string; // ISO; default = hoje - 6 meses
  dateTo?: string; // ISO; default = hoje
  priorityThreshold?: number; // default 50
  limit?: number; // default 10 (top N); max 100
}

// R2b — GET /admin/reports/manual-output
export interface ManualOutputFilters {
  dateFrom?: string; // ISO; default = início do mês corrente
  dateTo?: string; // ISO; default = fim do mês corrente
  sectorId?: string; // filtra Movement.fromSectorId
  productId?: string;
  page?: number; // default 1
  limit?: number; // default 20, max 100
}

// Período (comum a R1/R2/R2b)

export interface ReportPeriod {
  dateFrom: Date;
  dateTo: Date;
}

// R1 — Relatório de Pedidos

export interface RequestReportItemRow {
  productId: string;
  productName: string;
  productSku: string;
  requestedQty: number;
  sentQty: number;
  fulfillmentPct: number; // 0–100
}

export interface RequestReportTotals {
  requestedQty: number;
  sentQty: number;
  fulfillmentPct: number; // 0–100
}

export interface RequestReportRow {
  id: string;
  sectorId: string;
  sectorName: string;
  status: PurchaseRequestStatus;
  createdAt: Date;
  finalizedAt: Date | null;
  createdById: string;
  createdByName: string | null;
  totals: RequestReportTotals;
  items: RequestReportItemRow[];
}

export interface RequestReportSummary {
  totalRequests: number;
  byStatus: Record<PurchaseRequestStatus, number>;
  totalRequestedQty: number;
  totalSentQty: number;
  overallFulfillmentPct: number; // 0–100
}

export interface RequestReportResponse {
  period: ReportPeriod;
  requests: RequestReportRow[];
  summary: RequestReportSummary;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// R2 — Consumo (global + por setor)

export interface ConsumptionProductRowBase {
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  consumedQty: number;
  consumedValueInCents: number;
  priority: boolean;
}

// ---- Global ----

export interface ConsumptionGlobalTopProduct extends ConsumptionProductRowBase {
  monthsWithConsumption: number;
  monthsInRange: number;
}

export interface ConsumptionGlobalSectorRow {
  sectorId: string;
  sectorName: string;
  totalConsumedQty: number;
  totalConsumedValueInCents: number;
  productsCount: number; // total de produtos distintos consumidos pelo setor
  topProducts: ConsumptionGlobalTopProduct[]; // limit = top N (default 10)
}

export interface ConsumptionGlobalSummary {
  totalConsumedQty: number;
  totalConsumedValueInCents: number;
  totalSectors: number;
  totalProducts: number;
  monthsInRange: number;
  priorityProductsCount: number;
}

export interface ConsumptionGlobalResponse {
  period: ReportPeriod;
  summary: ConsumptionGlobalSummary;
  bySector: ConsumptionGlobalSectorRow[];
  overallTopProducts: ConsumptionGlobalTopProduct[]; // top N global
}

// ---- Por setor ----

export interface ConsumptionMonthlyBreakdownPoint {
  month: string; // "YYYY-MM"
  consumedQty: number;
  consumedValueInCents: number;
}

export interface ConsumptionSectorProductRow extends ConsumptionProductRowBase {
  monthsWithConsumption: number;
  monthsInRange: number;
  monthlyBreakdown: ConsumptionMonthlyBreakdownPoint[];
}

export interface ConsumptionSectorSummary {
  totalConsumedQty: number;
  totalConsumedValueInCents: number;
  productsCount: number;
  monthsInRange: number;
  priorityProductsCount: number;
}

export interface ConsumptionSectorResponse {
  sector: { id: string; name: string };
  period: ReportPeriod;
  summary: ConsumptionSectorSummary;
  products: ConsumptionSectorProductRow[]; // ordenado por consumedQty desc; limit = top N
}

// R2b — Saídas manuais

export interface ManualOutputMovementRow {
  id: string;
  createdAt: Date;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  quantity: number; // negativo (SAIDA)
  reason: string | null;
  fromSectorId: string | null;
  fromSectorName: string | null;
  createdById: string;
  createdByName: string | null;
  unitPriceInCents: number | null;
  totalValueInCents: number; // quantity * unitPriceInCents (0 se unitPrice null)
}

export interface ManualOutputSectorSummary {
  sectorId: string;
  sectorName: string;
  totalMovements: number;
  totalQty: number;
  totalValueInCents: number;
}

export interface ManualOutputSummary {
  totalMovements: number;
  totalQty: number;
  totalValueInCents: number;
  bySector: ManualOutputSectorSummary[];
}

export interface ManualOutputResponse {
  period: ReportPeriod;
  movements: ManualOutputMovementRow[];
  summary: ManualOutputSummary;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Guardas de tipo usadas pelos controllers (re-export útil)

export type ReportMovementType = MovementType;
export type ReportTransferStatus = TransferStatus;
