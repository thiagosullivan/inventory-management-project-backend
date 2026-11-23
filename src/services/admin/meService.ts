// src/services/admin/meService.ts
import { auth } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import {
  ConfirmEmailChangeData,
  RequestEmailChangeData,
  SessionResponse,
  UpdateMyAvatarData,
  UpdateMyPasswordData,
  UpdateMyProfileData,
  UserResponse,
} from "../../types/user.types.js";
import { utapi } from "../../utils/uploadthing.js";
import { validateUserName } from "../../utils/validation.js";

const ME_RESPONSE_SELECT = {
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
  sector: { select: { id: true, name: true, isWarehouse: true } },
} as const;

const ALLOWED_AVATAR_HOST = "ufs.sh";
const LEGACY_AVATAR_HOST = "utfs.io";

function isAllowedAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    // Aceita <APP_ID>.ufs.sh (novo) ou utfs.io (legado)
    return (
      host === ALLOWED_AVATAR_HOST ||
      host.endsWith(`.${ALLOWED_AVATAR_HOST}`) ||
      host === LEGACY_AVATAR_HOST ||
      host.endsWith(`.${LEGACY_AVATAR_HOST}`)
    );
  } catch {
    return false;
  }
}

export const meService = {
  async getMyProfile(userId: string): Promise<UserResponse | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: ME_RESPONSE_SELECT,
    });
  },

  async updateMyProfile(
    userId: string,
    data: UpdateMyProfileData,
  ): Promise<UserResponse> {
    const validation = validateUserName(data.name);
    if (!validation.isValid) {
      throw new Error(`INVALID_NAME: ${validation.errors.join(", ")}`);
    }

    return prisma.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
      select: ME_RESPONSE_SELECT,
    });
  },

  async updateMyPassword(
    userId: string,
    data: UpdateMyPasswordData,
    headers: Headers,
  ): Promise<void> {
    if (!data.currentPassword || !data.newPassword) {
      throw new Error("Dados inválidos: senha atual e nova são obrigatórias");
    }
    if (data.newPassword.length < 6) {
      throw new Error(
        "Dados inválidos: nova senha deve ter pelo menos 6 caracteres",
      );
    }
    if (data.currentPassword === data.newPassword) {
      throw new Error(
        "Dados inválidos: nova senha deve ser diferente da atual",
      );
    }

    await auth.api.changePassword({
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: false,
      },
      headers,
    });
  },

  async updateMyAvatar(
    userId: string,
    data: UpdateMyAvatarData,
  ): Promise<UserResponse> {
    if (!data.url || !isAllowedAvatarUrl(data.url)) {
      throw new Error(
        "Dados inválidos: URL de avatar inválida (deve ser do UploadThing)",
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    // 🔹 Fase 7.9 — deleta a imagem antiga do UploadThing (se existir e for diferente)
    if (current?.image && current.image !== data.url) {
      try {
        const fileKey = current.image.split("/").pop();
        if (fileKey) await utapi.deleteFiles(fileKey);
      } catch (err) {
        // Loga mas não impede a troca (imagem órfã é menos crítica)
        console.error("Erro ao deletar avatar antigo:", err);
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: { image: data.url },
      select: ME_RESPONSE_SELECT,
    });
  },

  async revokeMySession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
  ): Promise<void> {
    if (sessionId === currentSessionId) {
      throw new Error(
        "CANNOT_REVOKE_CURRENT_SESSION: Você não pode revogar a sessão atual",
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session || session.userId !== userId) {
      throw new Error("Sessão não encontrada");
    }

    await prisma.session.delete({ where: { id: sessionId } });
  },

  async revokeAllMySessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ revoked: number }> {
    const result = await prisma.session.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });
    return { revoked: result.count };
  },

  /**
   * POST /me/email/request-change
   * 🔹 CORREÇÃO: usa auth.api.requestEmailChangeEmailOTP (plugin emailOTP)
   */
  async requestEmailChange(
    userId: string,
    data: RequestEmailChangeData,
    headers: Headers,
  ): Promise<void> {
    if (!data.newEmail || !data.newEmail.includes("@")) {
      throw new Error("Dados inválidos: novo e-mail inválido");
    }

    const existing = await prisma.user.findUnique({
      where: { email: data.newEmail },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`Email ${data.newEmail} já cadastrado`);
    }

    // Método correto do plugin emailOTP (server-side)
    await auth.api.requestEmailChangeEmailOTP({
      body: { newEmail: data.newEmail },
      headers,
    });
  },

  /**
   * POST /me/email/confirm-change
   * 🔹 CORREÇÃO: usa auth.api.changeEmailEmailOTP (plugin emailOTP)
   */
  async confirmEmailChange(
    userId: string,
    data: ConfirmEmailChangeData,
    headers: Headers,
  ): Promise<void> {
    if (!data.otp || !data.newEmail) {
      throw new Error("Dados inválidos: newEmail e OTP são obrigatórios");
    }

    // Método correto do plugin emailOTP (server-side), aceita { newEmail, otp }
    await auth.api.changeEmailEmailOTP({
      body: { newEmail: data.newEmail, otp: data.otp },
      headers,
    });
  },
};
