import { MovementStatus, MovementType } from "../generated/prisma/enums";

// 🔹 Tipo compartilhado da categoria aninhada
export interface ProductCategoryRef {
  id: string;
  name: string;
}

// Dados para criar um produto
export interface CreateProductData {
  name: string;
  sku?: string;
  description?: string;
  categoryId: string; // 🔹 era: category: ProductCategory
  quantity?: number;
  minStock?: number;
  maxStock?: number;
  expiryDate?: Date | string;
  batchNumber?: string;
  location?: string;
  supplier?: string;
}

// Dados para atualizar um produto
export interface UpdateProductData {
  name?: string;
  sku?: string;
  description?: string;
  categoryId?: string; // 🔹 era: category?: ProductCategory
  quantity?: number;
  minStock?: number;
  maxStock?: number;
  expiryDate?: Date | string | null;
  batchNumber?: string;
  location?: string;
  supplier?: string;
  reason?: string;
}

// Resposta da API para produto
export interface ProductResponse {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string; // 🔹 era: category: ProductCategory
  category?: ProductCategoryRef; // 🔹 relação (opcional, depende do include)
  quantity: number;
  minStock: number | null;
  maxStock: number | null;
  expiryDate: Date | null;
  batchNumber: string | null;
  location: string | null;
  supplier: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  updatedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// Lista de produtos com paginação
export interface ProductsListResponse {
  products: ProductResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filtros para listagem de produtos
export interface ProductFilters {
  search?: string;
  categoryId?: string; // 🔹 era: category?: ProductCategory
  minQuantity?: number;
  maxQuantity?: number;
  hasExpiryDate?: boolean;
  isExpiring?: boolean;
  isLowStock?: boolean;
  createdById?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "quantity" | "expiryDate";
  sortOrder?: "asc" | "desc";
}

// Dados para movimentação de estoque
export interface MovementData {
  productId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
}

// Resposta de movimentação
export interface MovementResponse {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  status: MovementStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    quantity: number;
  };
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
}

// Resumo de estoque
export interface StockSummary {
  totalProducts: number;
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  categories: {
    categoryId: string; // 🔹 era: category: ProductCategory
    categoryName: string; // 🔹 NOVO: nome pra exibir no dashboard
    count: number;
    items: number;
  }[];
}
