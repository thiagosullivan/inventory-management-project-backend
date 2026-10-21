// src/types/category.types.ts
import { CustomCategory } from "../generated/prisma/client";

// Dados para criar uma categoria
export interface CreateCategoryData {
  name: string;
  description?: string;
}

// Dados para atualizar uma categoria
export interface UpdateCategoryData {
  name?: string;
  description?: string;
}

// Resposta da API para categoria
export interface CategoryResponse {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
  createdById: string;
  createdBy?: { id: string; name: string | null };
  _count?: { products: number };
  createdAt: Date;
  updatedAt: Date;
}

// Lista de categorias com paginação
export interface CategoriesListResponse {
  categories: CategoryResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filtros para listagem de categorias
export interface CategoryFilters {
  search?: string;
  page?: number;
  limit?: number;
}

// 🔹 Tipo do /options — ganha prefix
export interface CategoryOption {
  label: string;
  value: string;
  prefix: string; // 🔹 NOVO
}
