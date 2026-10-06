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

/**
 * 🔹 Checa se o usuário pode modificar (editar/deletar) uma categoria.
 * Regra (Modelo 3): MANAGER pode tudo; STAFF só as que ele criou.
 * Lança erro se não puder.
 */
async function ensureCanModifyCategory(
  categoryId: string,
  userId: string,
  action: "editar" | "deletar",
): Promise<{ id: string; createdById: string; _count: { products: number } }> {
  const category = await prisma.customCategory.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      createdById: true,
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    throw new Error("Categoria não encontrada");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const isManager = user?.role === Role.MANAGER;
  const isCreator = category.createdById === userId;

  if (!isManager && !isCreator) {
    throw new Error(
      `Apenas o criador da categoria ou um MANAGER podem ${action}-la`,
    );
  }

  return category;
}

export const categoryService = {
  // Create category (STAFF + MANAGER)
  async createCategory(
    data: CreateCategoryData,
    userId: string,
  ): Promise<CategoryResponse> {
    const validation = validateCategoryData(data);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    // 🔹 Não checa mais role — qualquer autenticado cria
    // (a permissão é garantida pelo middleware isStaff na rota)

    const nameExists = await categoryNameExists(prisma, data.name);
    if (nameExists) {
      throw new Error(`Categoria "${data.name}" já existe`);
    }

    const category = await prisma.customCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        createdById: userId, // 🔹 dono da categoria
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

  // Update category (STAFF + MANAGER, mas STAFF só as próprias)
  async updateCategory(
    categoryId: string,
    data: UpdateCategoryData,
    userId: string,
  ): Promise<CategoryResponse> {
    // 🔹 Checagem de permissão (Modelo 3)
    await ensureCanModifyCategory(categoryId, userId, "editar");

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

  // Delete category (STAFF + MANAGER, mas STAFF só as próprias)
  async deleteCategory(categoryId: string, userId: string): Promise<void> {
    // 🔹 Checagem de permissão + já traz _count.products
    const category = await ensureCanModifyCategory(
      categoryId,
      userId,
      "deletar",
    );

    // 🔹 Checa produtos vinculados ANTES de deletar
    if (category._count.products > 0) {
      throw new Error(
        `Categoria em uso por ${category._count.products} produto(s). Não pode ser deletada.`,
      );
    }

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
