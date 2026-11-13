// src/types/history.types.ts
import {
  MovementStatus,
  MovementType,
  TransferStatus,
} from "../generated/prisma/enums.js";

// =============================
// Enums auxiliares (espelho)
// =============================

export type HistorySortOrder = "asc" | "desc";

// =============================
// Filtros
// =============================

export type HistoryStatusFilter = MovementStatus | TransferStatus;

/**
 * 🔹 Filtros de /admin/history
 * Base = GlobalMovementFilters (mesmos campos, mesma semântica) +
 * includeTransfers (default true).
 *
 * includeTransfers:
 *  - true  → events agrupados por transferId (Transfer + Movements da mesma transfer)
 *  - false → lista bruta de Movements (inclui Movements com transferId, sem agrupar)
 */
export interface HistoryFilters {
  type?: MovementType;
  status?: HistoryStatusFilter;
  createdById?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number; // default 1
  limit?: number; // default 20, max 100
  sortBy?: "createdAt"; // 🔹 só createdAt (merge unificado por createdAt)
  sortOrder?: HistorySortOrder; // default desc
  includeTransfers?: boolean; // default true
  hasTransfer?: boolean;
}

// =============================
// Refs (subset enxuto)
// =============================

export interface HistorySectorRef {
  id: string;
  name: string;
  isWarehouse: boolean;
}

export interface HistoryUserRef {
  id: string;
  name: string | null;
}

export interface HistoryProductRef {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
}

export interface HistoryMovementRef {
  id: string;
  type: MovementType;
  status: MovementStatus;
  quantity: number;
  reason: string | null;
  unitPriceInCents: number | null;
  createdAt: Date;
  product: HistoryProductRef;
  createdBy: HistoryUserRef;
  fromSector: HistorySectorRef | null;
  toSector: HistorySectorRef | null;
}

export interface HistoryTransferItemRef {
  productId: string;
  quantity: number;
  product: HistoryProductRef;
}

export interface HistoryTransferRef {
  id: string;
  status: "PENDENTE" | "CONCLUIDO" | "CANCELADO" | "RECUSADO";
  createdAt: Date;
  confirmedAt: Date | null;
  refusedAt: Date | null;
  cancelledAt: Date | null;
  reason: string | null;
  refusalReason: string | null;
  cancelReason: string | null;
  fromSector: HistorySectorRef;
  toSector: HistorySectorRef;
  createdBy: HistoryUserRef;
  items: HistoryTransferItemRef[];
  _count: { items: number };
}

// =============================
// Eventos (discriminados)
// =============================

/**
 * 🔹 Evento de /history — união discriminada por eventType.
 * - MOVEMENT: Movement sem transferId (ENTRADA, SAIDA manual, AJUSTE)
 *             OU qualquer Movement quando includeTransfers=false.
 * - TRANSFER: Transfer + Movements vinculados (TRANSFERENCIA + SAIDA da mesma transfer).
 */
export type HistoryEvent =
  | {
      eventType: "MOVEMENT";
      createdAt: Date; // para ordenação consistente
      movement: HistoryMovementRef;
    }
  | {
      eventType: "TRANSFER";
      createdAt: Date; // = Transfer.createdAt (para ordenação unificada)
      transfer: HistoryTransferRef;
      movements: HistoryMovementRef[]; // Movements vinculados (TRANSFERENCIA + SAIDA)
    };

// =============================
// Resposta
// =============================

export interface HistoryListResponse {
  events: HistoryEvent[];
  total: number; // eventos (Movements sem transferId + Transfers agrupadas)
  page: number;
  limit: number;
  totalPages: number;
}
