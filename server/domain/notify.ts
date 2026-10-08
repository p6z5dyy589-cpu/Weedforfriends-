import type { NotificationData, NotificationType } from "@shared/notifications";
import type { Mutator } from "../_core/mutation";
import type { LocalRecord } from "../store/types";

/** Builds in-app notification records (no push, no external service). */
export function notify(
  m: Mutator,
  actorId: number,
  recipients: Iterable<number | null | undefined>,
  type: NotificationType,
  ref: { taskId?: string; conversationId?: string } = {},
): LocalRecord[] {
  const unique = new Set<number>();
  for (const r of recipients) if (typeof r === "number" && r !== actorId) unique.add(r);
  return [...unique].map((userId) =>
    m.newRecord<NotificationData>(
      "notification",
      { type, actorId, taskId: ref.taskId ?? null, conversationId: ref.conversationId ?? null, readAt: null },
      { ownerUserId: userId },
    ),
  );
}
