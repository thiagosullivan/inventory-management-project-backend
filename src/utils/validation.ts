// src/utils/validation.ts

import { Role } from "../generated/prisma/enums";

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
