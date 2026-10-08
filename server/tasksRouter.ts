import { z } from "zod";
import { hasAnyRole } from "@shared/roles";
import {
  BLOCK_REASONS,
  PROCESS_TYPES,
  TASK_SOURCE,
  UNITS,
  WORK_TYPES,
  canCompleteIncoming,
  canCompletePacking,
  canSubmitForReview,
  type TaskData,
  type TaskStatus,
} from "@shared/tasks";
import type { FileMeta } from "@shared/files";
import { router, kioskProcedure } from "./_core/trpc";
import { mutationBase, notFound, runMutation, stop, type MutationCtx, type Mutator, type Plan } from "./_core/mutation";
import {
  OVERSIGHT_ROLES,
  PLAN_ROLES,
  REVIEW_ROLES,
  visibleTasks,
  loadDependency,
  loadTask,
  permissions,
  require,
  type Actor,
  type TaskRecord,
} from "./domain/tasks";
import { companyPeople, personInCompany, usersWithRole } from "./domain/people";
import { notify } from "./domain/notify";
import type { LocalRecord } from "./store/types";

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const qty = z.number().positive().max(1_000_000);

const materialLine = z.object({
  component: text(120).min(1),
  lot: text(64),
  quantity: qty.nullable(),
  unit: z.enum(UNITS),
});
const packLineInput = z.object({ product: text(120).min(1), quantity: qty, unit: z.enum(UNITS), lotInfo: text(64) });
const taskRef = mutationBase.extend({ taskId: z.string().min(1).max(64), version: z.number().int() });

const actorOf = (ctx: MutationCtx): Actor => ({ userId: ctx.user.id, roles: ctx.roles });
const nowIso = (ctx: MutationCtx) => ctx.now().toISOString();

async function assertAssignee(ctx: MutationCtx, userId: number | null | undefined) {
  if (userId === null || userId === undefined) return;
  if (!(await personInCompany(ctx.store, ctx.companyId, userId))) stop("person_not_in_company");
}

async function permsFor(ctx: MutationCtx, rec: TaskRecord) {
  const dep = await loadDependency(ctx.store, ctx.companyId, rec.data);
  const depRec = rec.data.dependsOnTaskId ? await ctx.store.getRecord<TaskData>(ctx.companyId, "task", rec.data.dependsOnTaskId) : null;
  return permissions(rec.data, actorOf(ctx), dep, depRec?.data.assigneeId ?? null);
}

/** Loads the task, checks the version and the permission, then applies a change. */
async function taskAction(
  ctx: MutationCtx,
  input: z.infer<typeof taskRef>,
  procedure: string,
  build: (rec: TaskRecord, m: Mutator, can: Awaited<ReturnType<typeof permsFor>>) => Promise<{ data: TaskData; extra?: LocalRecord[]; event: string; payload?: unknown }>,
) {
  return runMutation(ctx, input, procedure, async (m): Promise<Plan<{ version: number; status: TaskStatus }>> => {
    const rec = await loadTask(ctx.store, ctx.companyId, input.taskId, actorOf(ctx), input.version);
    const can = await permsFor(ctx, rec);
    const { data, extra, event, payload } = await build(rec, m, can);
    m.event("task", rec.id, event, { from: rec.data.status, to: data.status, ...(payload as object) });
    return {
      updates: [m.change(rec, data, { ownerUserId: data.assigneeId })],
      creates: extra,
      result: { version: rec.version + 1, status: data.status },
    };
  });
}

function emptyTask(base: Partial<TaskData> & Pick<TaskData, "processType" | "reference" | "product" | "createdBy">): TaskData {
  return {
    workType: null,
    quantity: null,
    unit: "pcs",
    assigneeId: null,
    plannedDate: null,
    sequence: 0,
    status: "open",
    chainId: null,
    dependsOnTaskId: null,
    blocker: null,
    material: [],
    outputQuantity: null,
    zeroWaste: false,
    photoFileIds: [],
    workerNote: "",
    review: null,
    handover: null,
    packLines: [],
    incoming: null,
    ...base,
  };
}

export const LIST_SCOPES = ["mine", "team", "blocked", "ready", "review", "packing", "incoming"] as const;

export const tasksRouter = router({
  list: kioskProcedure.input(z.object({ scope: z.enum(LIST_SCOPES) })).query(async ({ ctx, input }) => {
    const actor = actorOf(ctx);
    const all = visibleTasks(await ctx.store.listRecords<TaskData>(ctx.companyId, "task"), actor);
    const oversight = hasAnyRole(ctx.roles, OVERSIGHT_ROLES);
    const pick = (r: TaskRecord): boolean => {
      const t = r.data;
      switch (input.scope) {
        case "mine":
          return t.assigneeId === ctx.user.id && t.status !== "cancelled";
        case "team":
          return oversight && t.status !== "cancelled";
        case "blocked":
          return t.status === "blocked";
        case "ready":
          return t.processType === "packing" && t.status === "packed";
        case "review":
          return t.status === "review";
        case "packing":
          return t.processType === "packing" && ["open", "handover_offered", "packing", "blocked"].includes(t.status);
        case "incoming":
          return t.processType === "incoming" && t.status !== "cancelled";
      }
    };
    const people = new Map((await companyPeople(ctx.store, ctx.companyId)).map((u) => [u.id, u.displayName]));
    return all
      .filter(pick)
      .sort((a, b) => (a.data.plannedDate ?? "9999").localeCompare(b.data.plannedDate ?? "9999") || a.data.sequence - b.data.sequence)
      .map((r) => ({
        id: r.id,
        version: r.version,
        processType: r.data.processType,
        reference: r.data.reference,
        product: r.data.product,
        quantity: r.data.quantity,
        unit: r.data.unit,
        status: r.data.status,
        plannedDate: r.data.plannedDate,
        assigneeName: r.data.assigneeId ? (people.get(r.data.assigneeId) ?? null) : null,
        blockReason: r.data.blocker?.reason ?? null,
        source: TASK_SOURCE,
      }));
  }),

  get: kioskProcedure.input(z.object({ id: z.string().min(1).max(64) })).query(async ({ ctx, input }) => {
    const rec = await loadTask(ctx.store, ctx.companyId, input.id, actorOf(ctx));
    const people = new Map((await companyPeople(ctx.store, ctx.companyId)).map((u) => [u.id, u.displayName]));
    const name = (id: number | null | undefined) => (id ? (people.get(id) ?? null) : null);
    const depRec = rec.data.dependsOnTaskId ? await ctx.store.getRecord<TaskData>(ctx.companyId, "task", rec.data.dependsOnTaskId) : null;
    return {
      id: rec.id,
      version: rec.version,
      companyId: rec.companyId,
      source: TASK_SOURCE,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      data: rec.data,
      assigneeName: name(rec.data.assigneeId),
      reviewerName: name(rec.data.review?.reviewerId),
      blockerName: name(rec.data.blocker?.reportedBy),
      dependency: depRec ? { id: depRec.id, product: depRec.data.product, status: depRec.data.status, processType: depRec.data.processType } : null,
      can: await permsFor(ctx, rec),
      checks: {
        submit: canSubmitForReview(rec.data),
        completePacking: canCompletePacking(rec.data),
        completeIncoming: canCompleteIncoming(rec.data),
      },
    };
  }),

  history: kioskProcedure.input(z.object({ id: z.string().min(1).max(64) })).query(async ({ ctx, input }) => {
    await loadTask(ctx.store, ctx.companyId, input.id, actorOf(ctx));
    const people = new Map((await ctx.store.listUsersForCompany(ctx.companyId)).map((u) => [u.id, u.displayName]));
    const events = await ctx.store.listEvents(ctx.companyId, "task", input.id);
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      at: e.createdAt,
      actorName: people.get(e.actorUserId) ?? null,
      to: (e.payload as { to?: TaskStatus } | null)?.to ?? null,
    }));
  }),

  create: kioskProcedure
    .input(
      mutationBase.extend({
        processType: z.enum(PROCESS_TYPES),
        workType: z.enum(WORK_TYPES).nullable(),
        reference: text(64).min(1),
        product: text(120).min(1),
        quantity: qty.nullable(),
        unit: z.enum(UNITS),
        assigneeId: z.number().int().nullable(),
        plannedDate: isoDate.nullable(),
        packLines: z.array(packLineInput).max(50).default([]),
        qualityPhotoRequired: z.boolean().default(false),
        containerSize: text(40).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mayCreate = hasAnyRole(ctx.roles, [...PLAN_ROLES, "reviewer"]) || (input.processType === "incoming" && ctx.roles.includes("incoming"));
      require(mayCreate, "not_allowed");
      await assertAssignee(ctx, input.assigneeId);
      return runMutation(ctx, input, "tasks.create", async (m) => {
        const data = emptyTask({
          processType: input.processType,
          workType: input.workType,
          reference: input.reference,
          product: input.product,
          quantity: input.quantity,
          unit: input.unit,
          assigneeId: input.assigneeId,
          plannedDate: input.plannedDate,
          createdBy: ctx.user.id,
          packLines: input.packLines.map((l) => ({ ...l, id: ctx.newId(), checked: false, checkedBy: null, deviation: null })),
          incoming:
            input.processType === "incoming"
              ? { deliveryNoteMatches: null, quantityMatches: null, qualityPhotoRequired: input.qualityPhotoRequired, containerSize: input.containerSize }
              : null,
        });
        const rec = m.newRecord("task", data, { ownerUserId: data.assigneeId });
        m.event("task", rec.id, "created", { to: "open" });
        return { creates: [rec, ...notify(m, ctx.user.id, [data.assigneeId], "task_assigned", { taskId: rec.id })], result: { id: rec.id } };
      });
    }),

  /** Local WFF/Ketama template: Bulk → Abpackung → Packen. Not an Odoo chain. */
  createChain: kioskProcedure
    .input(
      mutationBase.extend({
        reference: text(64).min(1),
        bulkProduct: text(120).min(1),
        bulkQuantity: qty.nullable(),
        bulkUnit: z.enum(UNITS),
        bulkWorkType: z.enum(["flowers", "hash", "vapes"]),
        endProduct: text(120).min(1),
        endQuantity: qty,
        endUnit: z.enum(UNITS),
        bulkAssigneeId: z.number().int().nullable(),
        packagingAssigneeId: z.number().int().nullable(),
        packAssigneeId: z.number().int().nullable(),
        plannedDate: isoDate.nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      require(hasAnyRole(ctx.roles, [...PLAN_ROLES, "reviewer"]));
      for (const id of [input.bulkAssigneeId, input.packagingAssigneeId, input.packAssigneeId]) await assertAssignee(ctx, id);
      return runMutation(ctx, input, "tasks.createChain", async (m) => {
        const chainId = ctx.newId();
        const common = { reference: input.reference, createdBy: ctx.user.id, chainId, plannedDate: input.plannedDate };
        const bulk = m.newRecord(
          "task",
          emptyTask({ ...common, processType: "production", workType: input.bulkWorkType, product: input.bulkProduct, quantity: input.bulkQuantity, unit: input.bulkUnit, assigneeId: input.bulkAssigneeId }),
          { ownerUserId: input.bulkAssigneeId },
        );
        const packaging = m.newRecord(
          "task",
          emptyTask({ ...common, processType: "packaging", workType: "packaging", product: input.endProduct, quantity: input.endQuantity, unit: input.endUnit, assigneeId: input.packagingAssigneeId, dependsOnTaskId: bulk.id }),
          { ownerUserId: input.packagingAssigneeId },
        );
        const packing = m.newRecord(
          "task",
          emptyTask({
            ...common,
            processType: "packing",
            workType: "packing",
            product: input.endProduct,
            quantity: input.endQuantity,
            unit: input.endUnit,
            assigneeId: input.packAssigneeId,
            dependsOnTaskId: packaging.id,
            packLines: [{ id: ctx.newId(), product: input.endProduct, quantity: input.endQuantity, unit: input.endUnit, lotInfo: "", checked: false, checkedBy: null, deviation: null }],
          }),
          { ownerUserId: input.packAssigneeId },
        );
        for (const r of [bulk, packaging, packing]) m.event("task", r.id, "created", { to: "open", chainId });
        const notes = [bulk, packaging, packing].flatMap((r) => notify(m, ctx.user.id, [(r.data as TaskData).assigneeId], "task_assigned", { taskId: r.id }));
        return { creates: [bulk, packaging, packing, ...notes], result: { chainId, ids: [bulk.id, packaging.id, packing.id] } };
      });
    }),

  start: kioskProcedure.input(taskRef).mutation(({ ctx, input }) =>
    taskAction(ctx, input, "tasks.start", async (rec, _m, can) => {
      if (!can.start && rec.data.dependsOnTaskId && rec.data.status === "open") stop("dependency_open");
      require(can.start);
      return { data: { ...rec.data, status: "in_progress" }, event: "started" };
    }),
  ),

  saveWork: kioskProcedure
    .input(
      taskRef.extend({
        material: z.array(materialLine).max(40),
        outputQuantity: qty.nullable(),
        zeroWaste: z.boolean(),
        workerNote: text(1000),
      }),
    )
    .mutation(({ ctx, input }) =>
      taskAction(ctx, input, "tasks.saveWork", async (rec, _m, can) => {
        require(can.editWork);
        const source = rec.data.status === "review" ? "reviewer" : "worker";
        return {
          data: {
            ...rec.data,
            material: input.material.map((l) => ({ ...l, id: ctx.newId(), source })),
            outputQuantity: input.outputQuantity,
            zeroWaste: input.zeroWaste,
            workerNote: source === "worker" ? input.workerNote : rec.data.workerNote,
          },
          event: source === "reviewer" ? "material_corrected" : "work_saved",
          payload: { lines: input.material.length, zeroWaste: input.zeroWaste },
        };
      }),
    ),

  addPhoto: kioskProcedure.input(taskRef.extend({ fileId: z.string().uuid() })).mutation(({ ctx, input }) =>
    taskAction(ctx, input, "tasks.addPhoto", async (rec, _m, can) => {
      require(can.addPhoto);
      const file = await ctx.store.getRecord<FileMeta>(ctx.companyId, "file", input.fileId);
      if (!file || file.data.uploadedBy !== ctx.user.id) notFound();
      if (rec.data.photoFileIds.includes(input.fileId)) stop("photo_already_added");
      if (rec.data.photoFileIds.length >= 10) stop("too_many_photos");
      return { data: { ...rec.data, photoFileIds: [...rec.data.photoFileIds, input.fileId] }, event: "photo_added" };
    }),
  ),

  removePhoto: kioskProcedure.input(taskRef.extend({ fileId: z.string().uuid() })).mutation(({ ctx, input }) =>
    taskAction(ctx, input, "tasks.removePhoto", async (rec, _m, can) => {
      require(can.addPhoto);
      return { data: { ...rec.data, photoFileIds: rec.data.photoFileIds.filter((f) => f !== input.fileId) }, event: "photo_removed" };
    }),
  ),

  submit: kioskProcedure.input(taskRef).mutation(async ({ ctx, input }) => {
    const reviewers = await usersWithRole(ctx.store, ctx.companyId, ["reviewer"]);
    return taskAction(ctx, input, "tasks.submit", async (rec, m, can) => {
      const reason = canSubmitForReview(rec.data);
      if (reason) stop(reason);
      require(can.submit);
      return {
        data: { ...rec.data, status: "review", review: null },
        extra: notify(m, ctx.user.id, reviewers, "review_waiting", { taskId: rec.id }),
        event: "submitted",
      };
    });
  }),

  /** Vincent's local decision. Never an Odoo completion. */
  review: kioskProcedure
    .input(taskRef.extend({ decision: z.enum(["approved", "returned"]), note: text(1000) }))
    .mutation(({ ctx, input }) =>
      taskAction(ctx, input, "tasks.review", async (rec, m, can) => {
        require(can.review);
        const t = rec.data;
        if (input.decision === "approved") {
          if (t.material.length === 0) stop("material_missing");
          if (t.material.some((l) => !l.lot)) stop("lot_missing");
          if (t.material.some((l) => l.quantity === null)) stop("quantity_missing");
          if (t.outputQuantity === null && !t.zeroWaste) stop("output_missing");
        } else if (!input.note) {
          stop("note_required");
        }
        return {
          data: {
            ...t,
            status: input.decision === "approved" ? "approved" : "in_progress",
            review: { reviewerId: ctx.user.id, at: nowIso(ctx), decision: input.decision, note: input.note },
          },
          extra: notify(m, ctx.user.id, [t.assigneeId], input.decision === "approved" ? "review_approved" : "review_returned", { taskId: rec.id }),
          event: input.decision === "approved" ? "review_approved_local" : "review_returned",
        };
      }),
    ),

  /** "Ware für Packen anbieten" - step 1 of the two-step handover. */
  offer: kioskProcedure.input(taskRef).mutation(async ({ ctx, input }) => {
    const packers = await usersWithRole(ctx.store, ctx.companyId, ["pack"]);
    return taskAction(ctx, input, "tasks.offer", async (rec, m, can) => {
      if (rec.data.status === "open" && rec.data.dependsOnTaskId && !can.offer) {
        const dep = await loadDependency(ctx.store, ctx.companyId, rec.data);
        if (dep && dep.status !== "approved") stop("dependency_open");
      }
      require(can.offer);
      const recipients = rec.data.assigneeId ? [rec.data.assigneeId] : packers;
      return {
        data: { ...rec.data, status: "handover_offered", handover: { offeredBy: ctx.user.id, offeredAt: nowIso(ctx), acceptedBy: null, acceptedAt: null } },
        extra: notify(m, ctx.user.id, recipients, "handover_offered", { taskId: rec.id }),
        event: "handover_offered",
      };
    });
  }),

  /** "Ware am Packplatz annehmen" - step 2. A deviation blocks instead of accepting. */
  accept: kioskProcedure.input(taskRef.extend({ deviation: text(500).nullable() })).mutation(async ({ ctx, input }) => {
    const coordinators = await usersWithRole(ctx.store, ctx.companyId, ["coordinator", "qm"]);
    return taskAction(ctx, input, "tasks.accept", async (rec, m, can) => {
      require(can.accept);
      const handover = { ...rec.data.handover!, acceptedBy: ctx.user.id, acceptedAt: nowIso(ctx) };
      if (input.deviation) {
        return {
          data: {
            ...rec.data,
            assigneeId: ctx.user.id,
            status: "blocked",
            blocker: { reason: "quantity", note: input.deviation, reportedBy: ctx.user.id, at: nowIso(ctx), previousStatus: "handover_offered" },
          },
          extra: notify(m, ctx.user.id, coordinators, "task_blocked", { taskId: rec.id }),
          event: "handover_deviation",
        };
      }
      return {
        data: { ...rec.data, assigneeId: ctx.user.id, status: "packing", handover },
        extra: notify(m, ctx.user.id, [rec.data.handover?.offeredBy], "handover_accepted", { taskId: rec.id }),
        event: "handover_accepted",
      };
    });
  }),

  checkLine: kioskProcedure
    .input(taskRef.extend({ lineId: z.string().min(1).max(64), checked: z.boolean(), deviation: text(500).nullable() }))
    .mutation(({ ctx, input }) =>
      taskAction(ctx, input, "tasks.checkLine", async (rec, _m, can) => {
        require(can.checkLines);
        if (!rec.data.packLines.some((l) => l.id === input.lineId)) notFound();
        const deviation = input.deviation || null;
        return {
          data: {
            ...rec.data,
            packLines: rec.data.packLines.map((l) =>
              l.id === input.lineId
                ? { ...l, checked: input.checked && !deviation, checkedBy: input.checked && !deviation ? ctx.user.id : null, deviation }
                : l,
            ),
          },
          event: deviation ? "pack_line_deviation" : input.checked ? "pack_line_checked" : "pack_line_unchecked",
          payload: { lineId: input.lineId },
        };
      }),
    ),

  completePacking: kioskProcedure.input(taskRef).mutation(({ ctx, input }) =>
    taskAction(ctx, input, "tasks.completePacking", async (rec, _m, can) => {
      const reason = canCompletePacking(rec.data);
      if (reason) stop(reason);
      require(can.completePacking);
      return { data: { ...rec.data, status: "packed" }, event: "packed_local" };
    }),
  ),

  saveIncoming: kioskProcedure
    .input(taskRef.extend({ deliveryNoteMatches: z.boolean().nullable(), quantityMatches: z.boolean().nullable(), containerSize: text(40) }))
    .mutation(({ ctx, input }) =>
      taskAction(ctx, input, "tasks.saveIncoming", async (rec, _m, can) => {
        require(can.editIncoming);
        return {
          data: {
            ...rec.data,
            incoming: { ...rec.data.incoming!, deliveryNoteMatches: input.deliveryNoteMatches, quantityMatches: input.quantityMatches, containerSize: input.containerSize },
          },
          event: "incoming_checked_step",
        };
      }),
    ),

  completeIncoming: kioskProcedure.input(taskRef).mutation(({ ctx, input }) =>
    taskAction(ctx, input, "tasks.completeIncoming", async (rec, _m, can) => {
      const reason = canCompleteIncoming(rec.data);
      if (reason) stop(reason);
      require(can.completeIncoming);
      return { data: { ...rec.data, status: "checked" }, event: "incoming_checked_local" };
    }),
  ),

  complete: kioskProcedure.input(taskRef).mutation(({ ctx, input }) =>
    taskAction(ctx, input, "tasks.complete", async (rec, _m, can) => {
      require(can.complete);
      return { data: { ...rec.data, status: "done" }, event: "done_local" };
    }),
  ),

  /** "Etwas passt nicht" - the one safe way out. */
  report: kioskProcedure.input(taskRef.extend({ reason: z.enum(BLOCK_REASONS), note: text(1000).min(1) })).mutation(async ({ ctx, input }) => {
    const responsible = await usersWithRole(ctx.store, ctx.companyId, ["coordinator", "qm"]);
    return taskAction(ctx, input, "tasks.report", async (rec, m, can) => {
      require(can.report);
      return {
        data: {
          ...rec.data,
          status: "blocked",
          blocker: { reason: input.reason, note: input.note, reportedBy: ctx.user.id, at: nowIso(ctx), previousStatus: rec.data.status },
        },
        extra: notify(m, ctx.user.id, responsible, "task_blocked", { taskId: rec.id }),
        event: "blocked",
        payload: { reason: input.reason },
      };
    });
  }),

  resolve: kioskProcedure
    .input(taskRef.extend({ decision: z.enum(["resume", "cancel"]), note: text(1000).min(1) }))
    .mutation(({ ctx, input }) =>
      taskAction(ctx, input, "tasks.resolve", async (rec, m, can) => {
        require(can.resolve);
        const prev = rec.data.blocker?.previousStatus ?? "open";
        return {
          data: { ...rec.data, status: input.decision === "cancel" ? "cancelled" : prev, blocker: null },
          extra: notify(m, ctx.user.id, [rec.data.assigneeId], "blocker_resolved", { taskId: rec.id }),
          event: input.decision === "cancel" ? "cancelled_after_clarification" : "clarified",
          payload: { note: input.note },
        };
      }),
    ),

  /** Plan only work that has not started; running work is never moved. */
  plan: kioskProcedure
    .input(taskRef.extend({ assigneeId: z.number().int().nullable(), plannedDate: isoDate.nullable(), sequence: z.number().int().min(0).max(10_000) }))
    .mutation(async ({ ctx, input }) => {
      await assertAssignee(ctx, input.assigneeId);
      return taskAction(ctx, input, "tasks.plan", async (rec, m, can) => {
        if (!hasAnyRole(ctx.roles, PLAN_ROLES)) require(false);
        if (rec.data.status !== "open") stop("task_started");
        require(can.plan);
        const reassigned = input.assigneeId !== rec.data.assigneeId;
        return {
          data: { ...rec.data, assigneeId: input.assigneeId, plannedDate: input.plannedDate, sequence: input.sequence },
          extra: reassigned ? notify(m, ctx.user.id, [input.assigneeId], "task_assigned", { taskId: rec.id }) : [],
          event: "planned",
          payload: { reassigned },
        };
      });
    }),

  /** Multi-select planning: all items re-checked, all or nothing. Only not-started work. */
  planMany: kioskProcedure
    .input(
      mutationBase.extend({
        items: z.array(z.object({ taskId: z.string().min(1).max(64), version: z.number().int() })).min(1).max(100),
        assigneeId: z.number().int().nullable().optional(),
        plannedDate: isoDate.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      require(hasAnyRole(ctx.roles, PLAN_ROLES));
      await assertAssignee(ctx, input.assigneeId);
      return runMutation(ctx, input, "tasks.planMany", async (m) => {
        const updates = [];
        const creates = [];
        for (const item of input.items) {
          const rec = await loadTask(ctx.store, ctx.companyId, item.taskId, actorOf(ctx), item.version);
          if (rec.data.status !== "open") stop("task_started");
          const data = { ...rec.data };
          if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
          if (input.plannedDate !== undefined) data.plannedDate = input.plannedDate;
          const reassigned = data.assigneeId !== rec.data.assigneeId;
          updates.push(m.change(rec, data, { ownerUserId: data.assigneeId }));
          m.event("task", rec.id, "planned", { from: "open", to: "open", reassigned });
          if (reassigned) creates.push(...notify(m, ctx.user.id, [data.assigneeId], "task_assigned", { taskId: rec.id }));
        }
        return { updates, creates, result: { planned: updates.length } };
      });
    }),

  cancel: kioskProcedure.input(taskRef.extend({ note: text(1000).min(1) })).mutation(({ ctx, input }) =>
    taskAction(ctx, input, "tasks.cancel", async (rec, _m, can) => {
      require(can.cancel);
      return { data: { ...rec.data, status: "cancelled", blocker: null }, event: "cancelled", payload: { note: input.note } };
    }),
  ),
});

export { REVIEW_ROLES };
