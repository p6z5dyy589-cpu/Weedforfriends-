import { describe, expect, it } from "vitest";
import { teamHarness } from "./test/fixtures";

describe("chat", () => {
  it("team chat with @mention, unread badge and read marker", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    const hus = await t.h.as("hus");
    await jakub.api.chat.send(jakub.m({ target: { kind: "team" }, text: "Hallo @hus, Material ist da" }));
    expect(await hus.api.chat.unreadTotal()).toBe(1);
    expect((await hus.api.notifications.list()).map((n) => n.type)).toEqual(["chat_mention"]);
    const conv = await hus.api.chat.open({ target: { kind: "team" } });
    await hus.api.chat.markRead(hus.m({ conversationId: conv.id }));
    t.h.advance(1);
    expect(await hus.api.chat.unreadTotal()).toBe(0);
  });

  it("direct chats are private and show read status", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    const hus = await t.h.as("hus");
    const packer = await t.h.as("packer");
    const { conversationId } = await jakub.api.chat.send(jakub.m({ target: { kind: "direct", userId: t.ids.hus }, text: "Kurze Frage" }));
    await expect(packer.api.chat.open({ target: { kind: "id", id: conversationId } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await jakub.api.chat.open({ target: { kind: "id", id: conversationId } })).messages[0]!.readByOther).toBe(false);
    t.h.advance(1);
    await hus.api.chat.markRead(hus.m({ conversationId }));
    expect((await jakub.api.chat.open({ target: { kind: "id", id: conversationId } })).messages[0]!.readByOther).toBe(true);
  });

  it("cannot open a direct chat with a person of another company", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    await expect(jakub.api.chat.send(jakub.m({ target: { kind: "direct", userId: t.ids.xenon }, text: "hi" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("task chat follows task visibility; team chat is per company", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const jakub = await t.h.as("jakub");
    const hus = await t.h.as("hus");
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "production", workType: "flowers", reference: "MO-1", product: "Haze", quantity: 1, unit: "g", assigneeId: t.ids.jakub, plannedDate: null }),
    );
    await jakub.api.chat.send(jakub.m({ target: { kind: "task", taskId: id }, text: "Lot fehlt @hus" }));
    await expect(hus.api.chat.open({ target: { kind: "task", taskId: id } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // hus may not see the task, so the mention does not notify.
    expect(await hus.api.notifications.list()).toEqual([]);

    await coord.api.chat.send(coord.m({ target: { kind: "team" }, text: "Solovya intern" }));
    await coord.switchTo(2);
    const xenonTeam = await coord.api.chat.open({ target: { kind: "team" } });
    expect(xenonTeam.messages).toEqual([]);
  });

  it("the chat cannot change a task", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    const before = t.h.store.records.size;
    await jakub.api.chat.send(jakub.m({ target: { kind: "team" }, text: "freigeben bitte" }));
    const kinds = [...t.h.store.records.values()].slice(before).map((r) => r.kind);
    expect(kinds.every((k) => k === "conversation" || k === "chatMessage" || k === "notification")).toBe(true);
  });
});
