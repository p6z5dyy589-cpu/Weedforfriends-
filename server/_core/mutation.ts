import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { CompanyId } from "@shared/companies";
import type { Role } from "@shared/roles";
import type { Context } from "./context";
import {
  DuplicateRequestError,
  LoginNameTakenError,
  VersionConflictError,
  type Commit,
  type EventSubject,
  type KioskUser,
  type LocalEvent,
  type LocalRecord,
  type RecordKind,
} from "../store/types";

/**
 * Every local mutation carries a client-generated request id (idempotency)
 * and the company the client is showing. If the session company changed in
 * the meantime (other tab, switch), the action is refused - stale screens can
 * never act in the wrong company.
 */
export const mutationBase = z.object({
  requestId: z.string().uuid(),
  companyId: z.number().int(),
});

export interface MutationCtx extends Context {
  user: KioskUser;
  companyId: CompanyId;
  roles: Role[];
}

export type Plan<R> = Omit<Commit, "companyId" | "request" | "result"> & {
  result: R | ((out: { newUserId?: number }) => R);
};

export class Mutator {
  readonly events: LocalEvent[] = [];
  constructor(
    private readonly ctx: MutationCtx,
    private readonly requestId: string,
  ) {}

  newRecord<T>(kind: RecordKind, data: T, opts: { ownerUserId?: number | null; parentId?: string | null; id?: string } = {}): LocalRecord<T> {
    const now = this.ctx.now();
    return {
      id: opts.id ?? this.ctx.newId(),
      companyId: this.ctx.companyId,
      kind,
      version: 1,
      ownerUserId: opts.ownerUserId ?? null,
      parentId: opts.parentId ?? null,
      data,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Returns an updated copy plus the version guard for commit(). */
  change<T>(record: LocalRecord<T>, data: T, patch: { ownerUserId?: number | null } = {}) {
    return {
      record: { ...record, ...patch, data, updatedAt: this.ctx.now() } as LocalRecord,
      expectedVersion: record.version,
    };
  }

  event(subject: EventSubject, subjectId: string, type: string, payload: unknown = null): void {
    this.events.push({
      id: this.ctx.newId(),
      companyId: this.ctx.companyId,
      subject,
      subjectId,
      type,
      actorUserId: this.ctx.user.id,
      requestId: this.requestId,
      payload,
      createdAt: this.ctx.now(),
    });
  }
}

export async function runMutation<R>(
  ctx: MutationCtx,
  input: { requestId: string; companyId: number },
  procedure: string,
  build: (m: Mutator) => Promise<Plan<R>>,
): Promise<R> {
  if (input.companyId !== ctx.companyId) {
    throw new TRPCError({ code: "CONFLICT", message: "company_changed" });
  }
  const replay = async (): Promise<R> => {
    const prior = await ctx.store.findRequest(ctx.companyId, input.requestId);
    if (!prior || prior.actorUserId !== ctx.user.id || prior.procedure !== procedure) {
      throw new TRPCError({ code: "CONFLICT", message: "request_reused" });
    }
    return prior.result as R;
  };
  if (await ctx.store.findRequest(ctx.companyId, input.requestId)) return replay();

  const m = new Mutator(ctx, input.requestId);
  const plan = await build(m);
  const { result, ...ops } = plan;
  let computed: R | undefined;
  try {
    await ctx.store.commit({
      ...ops,
      events: [...(ops.events ?? []), ...m.events],
      companyId: ctx.companyId,
      request: { requestId: input.requestId, actorUserId: ctx.user.id, procedure },
      result: (out) => {
        computed = typeof result === "function" ? (result as (o: typeof out) => R)(out) : result;
        return computed;
      },
    });
  } catch (e) {
    if (e instanceof DuplicateRequestError) return replay();
    if (e instanceof VersionConflictError) throw new TRPCError({ code: "CONFLICT", message: "version" });
    if (e instanceof LoginNameTakenError) throw new TRPCError({ code: "CONFLICT", message: "login_taken" });
    throw e;
  }
  return computed as R;
}

export function notFound(): never {
  // Same answer for "does not exist" and "belongs to another company".
  throw new TRPCError({ code: "NOT_FOUND" });
}

export function stop(reason: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: reason });
}
