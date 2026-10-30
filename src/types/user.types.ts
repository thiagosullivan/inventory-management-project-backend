// src/types/user.types.ts
import { Role } from "../generated/prisma/enums";

export interface CreateStaffUserData {
  email: string;
  name: string;
  password: string;
  role?: Role;
  image?: string;
  sectorId: string; // 🔹 NOVO — obrigatório na Fase 6
}

export interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
  role: Role;
  isActive: boolean;
  sectorId: string; // 🔹 NOVO
}

export interface BetterAuthUserResponse {
  token: string;
  user: BetterAuthUser;
  redirect?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  lastLogin: Date | null;
  image: string | null;
  emailVerified: boolean;
  sectorId: string; // 🔹 NOVO
  sector?: {
    id: string;
    name: string;
    isWarehouse: boolean;
  }; // 🔹 NOVO — opcional
}

export interface UsersListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface UserFilters {
  search?: string;
  role?: Role;
  isActive?: boolean;
  sectorId?: string; // 🔹 NOVO
  page?: number;
  limit?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  isActive: boolean;
  sectorId: string; // 🔹 NOVO
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface UserOption {
  label: string;
  value: string;
  isActive: boolean;
}

// 🔹 NOVO — payload do PATCH /users/:id/sector
export interface UpdateUserSectorData {
  sectorId: string;
}
