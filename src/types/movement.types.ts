// src/types/movement.types.ts
import { MovementStatus, MovementType } from "../generated/prisma/enums";

export interface GlobalMovementFilters {
  type?: MovementType;
  status?: MovementStatus;
  createdById?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string; // busca em product.name/sku ou reason
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "quantity";
  sortOrder?: "asc" | "desc";
}

export interface GlobalMovementResponse {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  status: MovementStatus;
  unitPriceInCents: number | null;
  supplier: string | null;
  fromSectorId: string | null;
  toSectorId: string | null;
  transferId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string;
    imageUrl: string | null;
    priceInCents: number | null;
  };
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  fromSector?: {
    id: string;
    name: string;
    isWarehouse: boolean;
  } | null;
  toSector?: {
    id: string;
    name: string;
    isWarehouse: boolean;
  } | null;
}

export interface GlobalMovementsListResponse {
  movements: GlobalMovementResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
