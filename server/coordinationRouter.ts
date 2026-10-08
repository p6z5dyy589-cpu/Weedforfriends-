import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { WORK_TYPES, type TaskData, type WorkType } from "@shared/tasks";
import { ATTENDANCE, proposeSubstitutions, type Attendance, type AttendanceData, type MatrixData } from "@shared/coordination";
import type { CompanyId } from "@shared/companies";
import { router, roleProcedure } from "./_core/trpc";
import { mutationBase, runMutation, stop } from "./_core/mutation";
import { companyPeople, personInCompany } from "./domain/people";
import { notify } from "./domain/notify";
import type { LocalRecord, Store } from "./store/types";
import { plantDate } from "./domain/today";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const matrixId = (companyId: CompanyId, w: WorkType) => `${companyId}:matrix:${w}`;
const attendanceId = (companyId: CompanyId, date: string, userId: number) => `${companyId}:att:${date}:${userId}`;

async function loadAttendance(store: Store, companyId: CompanyId, date: string) {
  const people = await companyPeople(store, companyId);
  const map = new Map<number, Attendance>();
  const records = new Map<number, LocalRecord<AttendanceData>>();
  for (const p of people) {
    const rec = await store.getRecord<AttendanceData>(companyId, "attendance", attendanceId(companyId, date, p.id));
    map.set(p.id, rec?.data.status ?? "unknown");
    if (rec) records.set(p.id, rec);
  }
  return { people, map, records };
}

async function loadMatrix(store: Store, companyId: CompanyId) {
  const list = await store.listRecords<MatrixData>(companyId, "roleMatrix");
  return { list, map: new Map(list.map((r) => [r.data.workType, r.data])) };
}

const viewRoles = ["coordinator", "planner", "reviewer"] as const;

export const coordinationRouter = router({
  matrix: roleProcedure(...viewRoles).query(async ({ ctx }) => {
    const { list } = await loadMatrix(ctx.store, ctx.companyId);
    return WORK_TYPES.map((w) => {
      const rec = list.find((r) => r.data.workType === w);
      return { workType: w, version: rec?.version ?? 0, primaryUserId: rec?.data.primaryUserId ?? null, deputyUserIds: rec?.data.deputyUserIds ?? [] };
    });
  }),

  /** Suggestion matrix only - never changes an Odoo assignment. */
  setMatrix: roleProcedure("coordinator")
    .input(
      mutationBase.extend({
        workType: z.enum(WORK_TYPES),
        version: z.number().int().min(0),
        primaryUserId: z.number().int().nullable(),
        deputyUserIds: z.array(z.number().int()).max(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ids = [input.primaryUserId, ...input.deputyUserIds].filter((x): x is number => x !== null);
      if (new Set(ids).size !== ids.length) stop("duplicate_person");
      for (const id of ids) if (!(await personInCompany(ctx.store, ctx.companyId, id))) stop("person_not_in_company");
      return runMutation(ctx, input, "coordination.setMatrix", async (m) => {
        const id = matrixId(ctx.companyId, input.workType);
        const existing = await ctx.store.getRecord<MatrixData>(ctx.companyId, "roleMatrix", id);
        if ((existing?.version ?? 0) !== input.version) throw new TRPCError({ code: "CONFLICT", message: "version" });
        const data: MatrixData = { workType: input.workType, primaryUserId: input.primaryUserId, deputyUserIds: input.deputyUserIds };
        m.event("roleMatrix", id, "matrix_set", data);
        return existing
          ? { updates: [m.change(existing, data)], result: { ok: true as const } }
          : { creates: [m.newRecord("roleMatrix", data, { id })], result: { ok: true as const } };
      });
    }),

  attendance: roleProcedure(...viewRoles)
    .input(z.object({ date: isoDate.optional() }))
    .query(async ({ ctx, input }) => {
      const date = input.date ?? plantDate(ctx.now());
      const { people, map, records } = await loadAttendance(ctx.store, ctx.companyId, date);
      return {
        date,
        people: people
          .map((p) => ({ userId: p.id, displayName: p.displayName, status: map.get(p.id)!, version: records.get(p.id)?.version ?? 0 }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      };
    }),

  /** Local coordinator confirmation - not an external attendance source. */
  setAttendance: roleProcedure("coordinator")
    .input(mutationBase.extend({ date: isoDate, userId: z.number().int(), status: z.enum(ATTENDANCE), version: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await personInCompany(ctx.store, ctx.companyId, input.userId))) stop("person_not_in_company");
      return runMutation(ctx, input, "coordination.setAttendance", async (m) => {
        const id = attendanceId(ctx.companyId, input.date, input.userId);
        const existing = await ctx.store.getRecord<AttendanceData>(ctx.companyId, "attendance", id);
        if ((existing?.version ?? 0) !== input.version) throw new TRPCError({ code: "CONFLICT", message: "version" });
        const data: AttendanceData = { userId: input.userId, date: input.date, status: input.status };
        m.event("attendance", id, "attendance_set", { status: input.status });
        return existing
          ? { updates: [m.change(existing, data)], result: { ok: true as const } }
          : { creates: [m.newRecord("attendance", data, { id, ownerUserId: input.userId })], result: { ok: true as const } };
      });
    }),

  proposals: roleProcedure(...viewRoles)
    .input(z.object({ date: isoDate.optional() }))
    .query(async ({ ctx, input }) => {
      const date = input.date ?? plantDate(ctx.now());
      const [{ people, map }, { map: matrix }, tasks] = await Promise.all([
        loadAttendance(ctx.store, ctx.companyId, date),
        loadMatrix(ctx.store, ctx.companyId),
        ctx.store.listRecords<TaskData>(ctx.companyId, "task"),
      ]);
      const names = new Map(people.map((p) => [p.id, p.displayName]));
      const result = proposeSubstitutions({ date, tasks, attendance: map, matrix });
      const byId = new Map(tasks.map((t) => [t.id, t.data]));
      const describe = (id: string) => {
        const t = byId.get(id)!;
        return { reference: t.reference, product: t.product, workType: t.workType };
      };
      return {
        date,
        proposals: result.proposals.map((p) => ({ ...p, ...describe(p.taskId), fromName: names.get(p.fromUserId) ?? null, toName: names.get(p.toUserId) ?? null })),
        clarifications: result.clarifications.map((c) => ({ ...c, ...describe(c.taskId), userName: names.get(c.userId) ?? null })),
        runningStays: result.runningStays.map((id) => ({ taskId: id, ...describe(id), userName: names.get(byId.get(id)!.assigneeId!) ?? null })),
      };
    }),

  /** Deliberate (bulk) confirmation. Every item is re-validated; all or nothing. */
  confirmProposals: roleProcedure("coordinator")
    .input(
      mutationBase.extend({
        date: isoDate,
        items: z.array(z.object({ taskId: z.string().min(1).max(64), taskVersion: z.number().int(), toUserId: z.number().int() })).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { map } = await loadAttendance(ctx.store, ctx.companyId, input.date);
      return runMutation(ctx, input, "coordination.confirmProposals", async (m) => {
        const updates = [];
        const creates = [];
        for (const item of input.items) {
          const rec = await ctx.store.getRecord<TaskData>(ctx.companyId, "task", item.taskId);
          if (!rec || rec.version !== item.taskVersion) throw new TRPCError({ code: "CONFLICT", message: "version" });
          if (rec.data.status !== "open") stop("task_started");
          const from = rec.data.assigneeId;
          if (from === null || map.get(from) !== "absent") stop("assignee_not_absent");
          if (map.get(item.toUserId) !== "present") stop("target_not_present");
          updates.push(m.change(rec, { ...rec.data, assigneeId: item.toUserId }, { ownerUserId: item.toUserId }));
          m.event("task", rec.id, "substitution_confirmed", { from, to: item.toUserId });
          creates.push(...notify(m, ctx.user.id, [item.toUserId], "task_assigned", { taskId: rec.id }));
        }
        return { updates, creates, result: { moved: updates.length } };
      });
    }),
});
