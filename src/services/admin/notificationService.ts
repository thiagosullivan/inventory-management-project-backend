// src/services/admin/notificationService.ts
import { prisma } from "../../lib/prisma.js";
import { getIo } from "../../lib/socket.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  CreateNotificationPayload,
  NotificationFilters,
  NotificationsListResponse,
} from "../../types/notification.types.js";
import { sectorService } from "./sectorService.js";

/**
 * 🔹 Fase 8 — Emite o evento `notification:new` pra cada destinatário.
 * No-op se o io ainda não foi setado (scripts, testes).
 */
function emitNew(notifications: { userId: string }[] & any[]): void {
  const io = getIo();
  if (!io) return;
  for (const n of notifications) {
    io.to(`user:${n.userId}`).emit("notification:new", n);
  }
}

export const notificationService = {
  /**
   * Cria N notificações (1 por userId, com dedup) e emite via socket.
   */
  async createForUsers(
    userIds: string[],
    payload: CreateNotificationPayload,
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) return;

    const created = await prisma.notification.createManyAndReturn({
      data: uniqueIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link ?? null,
      })),
    });

    emitNew(created);
  },

  /**
   * Notifica todos os STAFF ativos de um setor.
   */
  async createForSector(
    sectorId: string,
    payload: CreateNotificationPayload,
  ): Promise<void> {
    const users = await prisma.user.findMany({
      where: { sectorId, isActive: true },
      select: { id: true },
    });
    await this.createForUsers(
      users.map((u) => u.id),
      payload,
    );
  },

  /**
   * Notifica STAFF do Almoxarifado + MANAGERs (dedup automático).
   */
  async createForAlmoxAndManagers(
    payload: CreateNotificationPayload,
  ): Promise<void> {
    const almoxId = await sectorService.getAlmoxarifadoId();
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ sectorId: almoxId }, { role: Role.MANAGER }],
      },
      select: { id: true },
    });
    await this.createForUsers(
      users.map((u) => u.id),
      payload,
    );
  },

  async listMyNotifications(
    userId: string,
    filters?: NotificationFilters,
  ): Promise<NotificationsListResponse> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (filters?.unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  },

  async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, isRead: true },
    });
    if (!existing) {
      throw new Error("NOTIFICATION_NOT_FOUND: Notificação não encontrada");
    }
    if (existing.isRead) return;

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  },
};
