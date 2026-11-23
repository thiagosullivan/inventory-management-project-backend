// src/types/user.types.ts
import { Role } from "../generated/prisma/enums";

export interface CreateStaffUserData {
  email: string;
  name: string;
  password: string;
  role?: Role;
  image?: string;
  sectorId: string;
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
  sectorId: string;
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
  sectorId: string;
  sector?: {
    id: string;
    name: string;
    isWarehouse: boolean;
  };
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
  sectorId?: string;
  page?: number;
  limit?: number;
}

export interface AuthenticatedSector {
  id: string;
  name: string;
  isWarehouse: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  image?: string | null;
  emailVerified: boolean;
  isActive: boolean;
  sectorId: string;
  sector: AuthenticatedSector;
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

// 🔹 Fase 6 — payload do PATCH /users/:id/sector
export interface UpdateUserSectorData {
  sectorId: string;
}

// 🔹 Fase 7.6 — payload do PATCH /users/:id/profile
export interface UpdateUserProfileData {
  name: string;
}