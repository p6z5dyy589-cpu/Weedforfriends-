export const NOTIFICATION_TYPES = [
  "task_assigned",
  "review_waiting",
  "review_approved",
  "review_returned",
  "handover_offered",
  "handover_accepted",
  "task_blocked",
  "blocker_resolved",
  "chat_mention",
  "direct_message",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Deliberately without product, lot, quantity or personal details. */
export interface NotificationData {
  type: NotificationType;
  actorId: number;
  taskId: string | null;
  conversationId: string | null;
  readAt: string | null;
}
