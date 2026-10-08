export type ConversationType = "team" | "direct" | "task";

export interface ConversationData {
  type: ConversationType;
  /** Direct chats: exactly the two members. Team/task: empty (access by rules). */
  memberIds: number[];
  taskId: string | null;
}

export interface ChatMessageData {
  authorId: number;
  text: string;
  mentionIds: number[];
}

export interface ChatReadData {
  userId: number;
  conversationId: string;
  lastReadAt: string;
}

export const MAX_MESSAGE_LENGTH = 2000;

/** Mentions are written as @kürzel (the login short name). */
export function extractMentions(text: string, people: { id: number; loginName: string }[]): number[] {
  const tokens = new Set([...text.matchAll(/(^|\s)@([a-zA-Z0-9._-]{2,32})/g)].map((m) => m[2]!.toLowerCase()));
  return people.filter((p) => tokens.has(p.loginName.toLowerCase())).map((p) => p.id);
}
