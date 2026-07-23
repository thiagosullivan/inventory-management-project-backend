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
  description: string | null;
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
