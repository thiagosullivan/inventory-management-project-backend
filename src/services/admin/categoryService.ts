// src/services/admin/categoryService.ts
import { prisma } from "../../lib/prisma.js";
import {
  CreateCategoryData,
  UpdateCategoryData,
  CategoryResponse,
  CategoriesListResponse,
  CategoryFilters,
} from "../../types/category.types.js";
import {
  validateCategoryData,
  categoryNameExists,
} from "../../utils/validation.js";
import { Role } from "../../generated/prisma/enums.js";

export const categoryService = {
  /**
   * Criar uma nova categoria (apenas MANAGER)
   */
  async createCategory(
    data: CreateCategoryData,
    adminId: string,
  ): Promise<CategoryResponse> {
    // 1. Validar dados
    const validation = validateCategoryData(data);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    // 2. Verificar se o admin é MANAGER
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== Role.MANAGER) {
      throw new Error("Apenas gerentes podem criar categorias");
    }

    // 3. Verificar se o nome já existe
    const nameExists = await categoryNameExists(prisma, data.name);
    if (nameExists) {
      throw new Error(`Categoria "${data.name}" já existe`);
    }

    // 4. Criar categoria
    const category = await prisma.customCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });

    return category;
  },

  /**
   * Listar todas as categorias (STAFF e MANAGER)
   */
  async listCategories(
    filters?: CategoryFilters,
  ): Promise<CategoriesListResponse> {
    // 1. Construir filtros
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // 2. Paginação
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // 3. Buscar categorias
    const [categories, total] = await Promise.all([
      prisma.customCategory.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.customCategory.count({ where }),
    ]);

    return {
      categories,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Buscar categoria por ID (STAFF e MANAGER)
   */
  async getCategoryById(categoryId: string): Promise<CategoryResponse | null> {
    const category = await prisma.customCategory.findUnique({
      where: { id: categoryId },
    });

    return category;
  },

  /**
   * Buscar categoria por nome (STAFF e MANAGER)
   */
  async getCategoryByName(name: string): Promise<CategoryResponse | null> {
    const category = await prisma.customCategory.findUnique({
      where: { name },
    });

    return category;
  },

  /**
   * Atualizar categoria (apenas MANAGER)
   */
  async updateCategory(
    categoryId: string,
    data: UpdateCategoryData,
    adminId: string,
  ): Promise<CategoryResponse> {
    // 1. Verificar se o admin é MANAGER
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== Role.MANAGER) {
      throw new Error("Apenas gerentes podem atualizar categorias");
    }

    // 2. Verificar se a categoria existe
    const existingCategory = await prisma.customCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      throw new Error("Categoria não encontrada");
    }

    // 3. Validar dados (se houver alteração)
    if (data.name) {
      const validation = validateCategoryData({
        name: data.name,
        description: data.description,
      });
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
      }

      // 4. Verificar se o novo nome já existe (excluindo a categoria atual)
      const nameExists = await categoryNameExists(
        prisma,
        data.name,
        categoryId,
      );
      if (nameExists) {
        throw new Error(`Categoria "${data.name}" já existe`);
      }
    }

    // 5. Atualizar categoria
    const updatedCategory = await prisma.customCategory.update({
      where: { id: categoryId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim() || null,
      },
    });

    return updatedCategory;
  },

  /**
   * Deletar categoria (apenas MANAGER)
   */
  async deleteCategory(categoryId: string, adminId: string): Promise<void> {
    // 1. Verificar se o admin é MANAGER
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== Role.MANAGER) {
      throw new Error("Apenas gerentes podem deletar categorias");
    }

    // 2. Verificar se a categoria existe
    const existingCategory = await prisma.customCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      throw new Error("Categoria não encontrada");
    }

    // 3. Verificar se a categoria está sendo usada por algum produto
    // Nota: Como você tem enum ProductCategory, as categorias personalizadas
    // podem ser usadas de forma diferente. Este é um check de segurança.
    // Se você relacionar CustomCategory com Product, adicione a verificação aqui.

    // 4. Deletar categoria
    await prisma.customCategory.delete({
      where: { id: categoryId },
    });
  },

  /**
   * Listar todas as categorias para dropdown (STAFF e MANAGER)
   */
  async getCategoryOptions(): Promise<{ label: string; value: string }[]> {
    const categories = await prisma.customCategory.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return categories.map((cat) => ({
      label: cat.name,
      value: cat.id,
    }));
  },
};
