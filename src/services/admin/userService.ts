// src/services/admin/userService.ts
import { Role } from "../../generated/prisma/client.js";
import { auth } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import {
  BetterAuthUserResponse,
  CreateStaffUserData,
  UpdateUserSectorData,
  UserFilters,
  UserOption,
  UserResponse,
  UsersListResponse,
} from "../../types/user.types.js";
import { isManager, validateUserData } from "../../utils/validation.js";

export const userService = {
  // Create user (Only manager)
  async createStaffUser(
    data: CreateStaffUserData,
    adminId: string,
  ): Promise<BetterAuthUserResponse> {
    const validation = validateUserData(data);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    // 🔹 NOVO — sectorId obrigatório
    if (!data.sectorId) {
      throw new Error("Dados inválidos: setor é obrigatório");
    }

    // verify if its a manager
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true, id: true, email: true },
    });

    if (!admin) {
      throw new Error("Administrador não encontrado");
    }

    if (!isManager(admin.role)) {
      throw new Error("Apenas gerentes podem criar usuários");
    }

    // 🔹 NOVO — valida se o setor existe
    const sector = await prisma.sector.findUnique({
      where: { id: data.sectorId },
      select: { id: true, isActive: true },
    });
    if (!sector) {
      throw new Error("Setor não encontrado");
    }
    if (!sector.isActive) {
      throw new Error("Setor está desativado");
    }

    // verify if email exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, email: true },
    });

    if (existing) {
      throw new Error(`Email ${data.email} já cadastrado`);
    }

    // Create user with better auth
    const userResponse = await auth.api.signUpEmail({
      body: {
        email: data.email,
        name: data.name,
        password: data.password,
        image: data.image,
        sectorId: data.sectorId, // 🔹 NOVO — obrigatório
      },
      headers: new Headers(),
    });

    // Update role and isActive
    if (userResponse.user?.id) {
      await prisma.user.update({
        where: { id: userResponse.user.id },
        data: {
          role: data.role || Role.STAFF,
          isActive: true,
        },
      });
    }

    return userResponse as BetterAuthUserResponse;
  },

  // List all users (only manager)
  async listUsers(
    adminId: string,
    filters?: UserFilters,
  ): Promise<UsersListResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem listar usuários");
    }

    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // 🔹 NOVO — filtro por setor (Fase 7.5 vai usar)
    if (filters?.sectorId) {
      where.sectorId = filters.sectorId;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          image: true,
          emailVerified: true,
          sectorId: true, // 🔹 NOVO
          sector: {
            select: { id: true, name: true, isWarehouse: true },
          }, // 🔹 NOVO
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
    };
  },

  // Get user by id
  async getUserById(
    userId: string,
    adminId: string,
  ): Promise<UserResponse | null> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem visualizar usuários");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        image: true,
        emailVerified: true,
        sectorId: true, // 🔹 NOVO
        sector: {
          select: { id: true, name: true, isWarehouse: true },
        }, // 🔹 NOVO
      },
    });

    return user;
  },

  // toggle active (only manager)
  async toggleUserStatus(
    userId: string,
    adminId: string,
  ): Promise<UserResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem alterar status de usuários");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        image: true,
        emailVerified: true,
        sectorId: true, // 🔹 NOVO
      },
    });

    return updated;
  },

  // update role (only manager)
  async updateUserRole(
    userId: string,
    newRole: Role,
    adminId: string,
  ): Promise<UserResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem alterar cargos de usuários");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        image: true,
        emailVerified: true,
        sectorId: true, // 🔹 NOVO
      },
    });

    return updated;
  },

  // 🔹 NOVO — update sector (only manager)
  async updateUserSector(
    userId: string,
    data: UpdateUserSectorData,
    adminId: string,
  ): Promise<UserResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem alterar o setor de usuários");
    }

    if (!data.sectorId) {
      throw new Error("Setor é obrigatório");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const sector = await prisma.sector.findUnique({
      where: { id: data.sectorId },
      select: { id: true, isActive: true },
    });
    if (!sector) {
      throw new Error("Setor não encontrado");
    }
    if (!sector.isActive) {
      throw new Error("Setor está desativado");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { sectorId: data.sectorId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        image: true,
        emailVerified: true,
        sectorId: true,
        sector: {
          select: { id: true, name: true, isWarehouse: true },
        },
      },
    });

    return updated;
  },

  // Delete user (only manager)
  async deleteUser(userId: string, adminId: string): Promise<UserResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem deletar usuários");
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new Error("Usuário não encontrado");
    }

    const deletedUser = await prisma.user.delete({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        image: true,
        emailVerified: true,
        sectorId: true, // 🔹 NOVO
      },
    });

    return deletedUser;
  },

  /**
   * List user options for dropdowns/selects.
   * GET /admin/users/options (STAFF + MANAGER)
   */
  async getUserOptions(): Promise<UserOption[]> {
    const users = await prisma.user.findMany({
      where: {
        createdProducts: { some: {} }, // 🔹 só quem criou pelo menos 1 produto
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    return users.map((u) => ({
      label: u.name ?? u.email,
      value: u.id,
      isActive: u.isActive,
    }));
  },
};
