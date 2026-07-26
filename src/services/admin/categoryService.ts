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
  // Create category (only MANAGER)
  async createCategory(
    data: CreateCategoryData,
    adminId: string,
  ): Promise<CategoryResponse> {
    const validation = validateCategoryData(data);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== Role.MANAGER) {
      throw new Error("Apenas gerentes podem criar categorias");
    }

    const nameExists = await categoryNameExists(prisma, data.name);
    if (nameExists) {
      throw new Error(`Categoria "${data.name}" já existe`);
    }

    const category = await prisma.customCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });

    return category;
  },

  // List all categories (STAFF and MANAGER)
  async listCategories(
    filters?: CategoryFilters,
  ): Promise<CategoriesListResponse> {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

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

  // Get category by ID (STAFF and MANAGER)
  async getCategoryById(categoryId: string): Promise<CategoryResponse | null> {
    const category = await prisma.customCategory.findUnique({
      where: { id: categoryId },
    });

    return category;
  },

  // Get category by name (STAFF and MANAGER)
  async getCategoryByName(name: string): Promise<CategoryResponse | null> {
    const category = await prisma.customCategory.findUnique({
      where: { name },
    });

    return category;
  },

  // Update category (only MANAGER)
  async updateCategory(
    categoryId: string,
    data: UpdateCategoryData,
    adminId: string,
  ): Promise<CategoryResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== Role.MANAGER) {
      throw new Error("Apenas gerentes podem atualizar categorias");
    }

    const existingCategory = await prisma.customCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      throw new Error("Categoria não encontrada");
    }

    if (data.name) {
      const validation = validateCategoryData({
        name: data.name,
        description: data.description,
      });
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
      }

      const nameExists = await categoryNameExists(
        prisma,
        data.name,
        categoryId,
      );
      if (nameExists) {
        throw new Error(`Categoria "${data.name}" já existe`);
      }
    }

    const updatedCategory = await prisma.customCategory.update({
      where: { id: categoryId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim() || null,
      },
    });

    return updatedCategory;
  },

  // Delete category (only MANAGER)
  async deleteCategory(categoryId: string, adminId: string): Promise<void> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== Role.MANAGER) {
      throw new Error("Apenas gerentes podem deletar categorias");
    }

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

    await prisma.customCategory.delete({
      where: { id: categoryId },
    });
  },

  // List category for dropdown (STAFF and MANAGER)
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
