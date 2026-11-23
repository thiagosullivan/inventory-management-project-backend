// src/types/notification.types.ts
import type {
  Notification,
  NotificationType,
} from "../generated/prisma/client.js";

export type { Notification, NotificationType };

export interface CreateNotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}

export interface NotificationFilters {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface NotificationsListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}
