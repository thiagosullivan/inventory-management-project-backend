// src/utils/validation.ts

import { Role } from "../generated/prisma/enums";

// USERS VALIDATIONS

// Validar se o usuário é MANAGER
export function isManager(role: Role): boolean {
  return role === Role.MANAGER;
}

// Validar se o usuário é STAFF
export function isStaff(role: Role): boolean {
  return role === Role.STAFF || role === Role.MANAGER;
}

// Validar email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validar senha (mínimo 6 caracteres)
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

// Validar dados do usuário
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

// CATEGORIES VALIDATIONS

// Validar dados da categoria
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

// Validar se a categoria existe
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

// Validar se o nome da categoria já existe
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
