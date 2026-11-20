// src/services/admin/userService.ts
import { Role } from "../../generated/prisma/client.js";
import { auth } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import {
  BetterAuthUserResponse,
  CreateStaffUserData,
  UpdateUserProfileData,
  UpdateUserSectorData,
  UserFilters,
  UserOption,
  UserResponse,
  UsersListResponse,
} from "../../types/user.types.js";
import {
  isManager,
  validateUserData,
  validateUserName,
} from "../../utils/validation.js";

// 🔹 Fase 7.6 — errors tipados por código (o controller mapeia por prefixo)
//    Não uso classe custom pra manter o padrão atual do projeto
//    (throw new Error + controller olhando error.message.includes).
//    Prefixos:
//      CANNOT_DELETE_MANAGER → 400
//      USER_HAS_ACTIVITY     → 409
//      CANNOT_DEMOTE_SELF    → 400
//      INVALID_NAME          → 400
//    O `error.message` começa com o código, e o controller checa.

const USER_RESPONSE_SELECT = {
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
} as const;

export const userService = {
  async createStaffUser(
    data: CreateStaffUserData,
    adminId: string,
  ): Promise<BetterAuthUserResponse> {
    const validation = validateUserData(data);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(", ")}`);
    }

    if (!data.sectorId) {
      throw new Error("Dados inválidos: setor é obrigatório");
    }

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

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, email: true },
    });

    if (existing) {
      throw new Error(`Email ${data.email} já cadastrado`);
    }

    const userResponse = await auth.api.signUpEmail({
      body: {
        email: data.email,
        name: data.name,
        password: data.password,
        image: data.image,
        sectorId: data.sectorId,
      },
      headers: new Headers(),
    });

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

    if (filters?.sectorId) {
      where.sectorId = filters.sectorId;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_RESPONSE_SELECT,
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

    return prisma.user.findUnique({
      where: { id: userId },
      select: USER_RESPONSE_SELECT,
    });
  },

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
    select: USER_RESPONSE_SELECT,
  });

  // 🔹 Fase 7.6 — ao inativar, revoga todas as sessões do usuário.
  //    Sem isso, a sessão antiga continua válida no banco e o usuário
  //    reativado entraria sem senha (sessão "fantasma").
  if (!updated.isActive) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  return updated;
},

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

    // 🔹 Fase 7.6 — guard: não pode rebaixar a si mesmo
    if (userId === adminId && newRole !== Role.MANAGER) {
      throw new Error("CANNOT_DEMOTE_SELF: Você não pode rebaixar seu próprio usuário");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: USER_RESPONSE_SELECT,
    });
  },

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

    return prisma.user.update({
      where: { id: userId },
      data: { sectorId: data.sectorId },
      select: USER_RESPONSE_SELECT,
    });
  },

  // 🔹 NOVO (Fase 7.6) — PATCH /admin/users/:id/profile
  async updateUserProfile(
    userId: string,
    data: UpdateUserProfileData,
    adminId: string,
  ): Promise<UserResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem alterar dados de usuários");
    }

    const validation = validateUserName(data.name);
    if (!validation.isValid) {
      throw new Error(`INVALID_NAME: ${validation.errors.join(", ")}`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    return prisma.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
      select: USER_RESPONSE_SELECT,
    });
  },

  async deleteUser(userId: string, adminId: string): Promise<UserResponse> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || !isManager(admin.role)) {
      throw new Error("Apenas gerentes podem deletar usuários");
    }

    // 🔹 Fase 7.6 — guards antes do delete
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, lastLogin: true, emailVerified: true, role: true },
    });

    if (!target) {
      throw new Error("Usuário não encontrado");
    }

    if (target.role === Role.MANAGER) {
      throw new Error("CANNOT_DELETE_MANAGER: Não é possível excluir um gerente");
    }

    if (target.lastLogin != null || target.emailVerified) {
      throw new Error(
        "USER_HAS_ACTIVITY: Usuário já teve atividade — use inativar",
      );
    }

    return prisma.user.delete({
      where: { id: userId },
      select: USER_RESPONSE_SELECT,
    });
  },

  async getUserOptions(): Promise<UserOption[]> {
    const users = await prisma.user.findMany({
      where: {
        createdProducts: { some: {} },
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