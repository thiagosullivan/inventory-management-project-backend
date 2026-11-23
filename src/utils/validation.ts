// src/utils/validation.ts
import { Role } from "../generated/prisma/enums";

// ============================================================
// USERS VALIDATIONS
// ============================================================

export function isManager(role: Role): boolean {
  return role === Role.MANAGER;
}

export function isStaff(role: Role): boolean {
  return role === Role.STAFF || role === Role.MANAGER;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function validateUserData(data: {
  email: string;
  name: string;
  password: string;
  role?: Role;
}) {
  const errors: string[] = [];

  if (!data.email || !isValidEmail(data.email)) {
    errors.push("Email inválido");
  }

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Nome deve ter pelo menos 2 caracteres");
  }

  if (!data.password || !isValidPassword(data.password)) {
    errors.push("Senha deve ter pelo menos 6 caracteres");
  }

  if (data.role && !Object.values(Role).includes(data.role)) {
    errors.push("Role inválida");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 🔹 Fase 7.6 — validação isolada do nome (usada no PATCH /:id/profile)
export function validateUserName(name: string | undefined | null): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!name || name.trim().length < 2) {
    errors.push("Nome deve ter pelo menos 2 caracteres");
  }
  if (name && name.length > 200) {
    errors.push("Nome deve ter no máximo 200 caracteres");
  }
  return { isValid: errors.length === 0, errors };
}

// ============================================================
// CATEGORIES VALIDATIONS (mantém igual)
// ============================================================

export function validateCategoryData(data: {
  name: string;
  description?: string;
}) {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Nome da categoria deve ter pelo menos 2 caracteres");
  }

  if (data.name && data.name.length > 50) {
    errors.push("Nome da categoria deve ter no máximo 50 caracteres");
  }

  if (data.description && data.description.length > 200) {
    errors.push("Descrição deve ter no máximo 200 caracteres");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function categoryExists(
  prisma: any,
  id: string,
): Promise<boolean> {
  const category = await prisma.customCategory.findUnique({
    where: { id },
    select: { id: true },
  });
  return !!category;
}

export async function categoryNameExists(
  prisma: any,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const where: any = {
    name: {
      equals: name,
      mode: "insensitive",
    },
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const category = await prisma.customCategory.findFirst({
    where,
    select: { id: true },
  });
  return !!category;
}

export function validateProductData(data: {
  name: string;
  sku?: string;
  categoryId?: string;
  quantity?: number;
  minStock?: number;
  maxStock?: number;
  price?: number;
  costPrice?: number;
}) {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Nome do produto deve ter pelo menos 2 caracteres");
  }

  if (data.name && data.name.length > 100) {
    errors.push("Nome do produto deve ter no máximo 100 caracteres");
  }

  if (data.sku && data.sku.length > 50) {
    errors.push("SKU deve ter no máximo 50 caracteres");
  }

  if (data.quantity !== undefined && data.quantity < 0) {
    errors.push("Quantidade não pode ser negativa");
  }

  if (data.minStock !== undefined && data.minStock < 0) {
    errors.push("Estoque mínimo não pode ser negativo");
  }

  if (data.maxStock !== undefined && data.maxStock < 0) {
    errors.push("Estoque máximo não pode ser negativo");
  }

  if (
    data.minStock !== undefined &&
    data.maxStock !== undefined &&
    data.minStock > data.maxStock
  ) {
    errors.push("Estoque mínimo não pode ser maior que o máximo");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateMovementData(data: {
  productId: string;
  type: string;
  quantity: number;
}) {
  const errors: string[] = [];

  if (!data.productId) {
    errors.push("ID do produto é obrigatório");
  }

  if (!data.type) {
    errors.push("Tipo de movimentação é obrigatório");
  }

  if (data.quantity === undefined || data.quantity <= 0) {
    errors.push("Quantidade deve ser maior que zero");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function skuExists(
  prisma: any,
  sku: string,
  excludeId?: string,
): Promise<boolean> {
  const where: any = { sku };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  const product = await prisma.product.findFirst({
    where,
    select: { id: true },
  });
  return !!product;
}

export function normalizeText(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}