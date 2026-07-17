import { Role } from "../generated/prisma/enums";

// Dados para criar um usuário (apenas MANAGER)
export interface CreateStaffUserData {
  email: string;
  name: string;
  password: string;
  role?: Role;
  image?: string;
}

// Usuário retornado pelo Better Auth (campos reais)
// O Better Auth retorna Date, não string
export interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// Resposta do Better Auth ao criar usuário (tipagem correta)
export interface BetterAuthUserResponse {
  token: string;
  user: BetterAuthUser;
  redirect?: boolean;
}

// Usuário retornado pela API (sem campos sensíveis)
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
}

// Lista de usuários com paginação
export interface UsersListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  limit: number;
}

// Filtros para listagem de usuários
export interface UserFilters {
  search?: string;
  role?: Role;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// Tipo para o usuário autenticado no request
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}

// Extensão do Request para incluir o usuário
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
