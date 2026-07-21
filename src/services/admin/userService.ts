import { Role } from "../../generated/prisma/client.js";
import { auth } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import {
  BetterAuthUserResponse,
  CreateStaffUserData,
  UserFilters,
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
    // verify role
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

    // verify if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // update role
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
      },
    });

    return deletedUser;
  },
};
