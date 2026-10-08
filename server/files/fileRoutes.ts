import { createHash } from "node:crypto";
import express from "express";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MAX_UPLOAD_BYTES, sniffImageType, type FileMeta } from "@shared/files";
import type { Context } from "../_core/context";
import { resolveKiosk } from "../_core/trpc";
import { runMutation } from "../_core/mutation";

const headerSchema = z.object({
  requestId: z.string().uuid(),
  companyId: z.coerce.number().int(),
});

const STATUS: Partial<Record<TRPCError["code"], number>> = { CONFLICT: 409, NOT_FOUND: 404, FORBIDDEN: 403 };

/**
 * Proof photo upload/download. Bound to the personal session and the active
 * company; a file of another company answers exactly like a missing one.
 */
export function createFileRoutes(contextFor: (req: express.Request, res: express.Response) => Context) {
  const r = express.Router();

  r.post("/", express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), async (req, res) => {
    try {
      const ctx = contextFor(req, res);
      const auth = await resolveKiosk(ctx);
      if (!auth) return res.status(401).json({ error: "unauthorized" });
      const headers = headerSchema.safeParse({ requestId: req.header("x-request-id"), companyId: req.header("x-company-id") });
      if (!headers.success) return res.status(400).json({ error: "bad_request" });
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: "empty" });
      const mime = sniffImageType(body);
      if (!mime) return res.status(415).json({ error: "unsupported_type" });

      const mctx = { ...ctx, ...auth };
      const prior = await ctx.store.findRequest(auth.companyId, headers.data.requestId);
      const result = await runMutation(mctx, headers.data, "files.upload", async (m) => {
        const meta: FileMeta = { mime, size: body.length, sha256: createHash("sha256").update(body).digest("hex"), uploadedBy: auth.user.id };
        const rec = m.newRecord("file", meta, { ownerUserId: auth.user.id });
        if (!prior) await ctx.files.put(auth.companyId, rec.id, body);
        m.event("file", rec.id, "uploaded", { size: meta.size, mime });
        return { creates: [rec], result: { fileId: rec.id } };
      });
      return res.json(result);
    } catch (e) {
      if (e instanceof TRPCError) return res.status(STATUS[e.code] ?? 400).json({ error: e.message || e.code });
      if ((e as { type?: string }).type === "entity.too.large") return res.status(413).json({ error: "too_large" });
      console.error("[files] upload failed");
      return res.status(500).json({ error: "internal" });
    }
  });

  r.get("/:id", async (req, res) => {
    const ctx = contextFor(req, res);
    const auth = await resolveKiosk(ctx);
    if (!auth) return res.status(401).end();
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(404).end();
    const rec = await ctx.store.getRecord<FileMeta>(auth.companyId, "file", id);
    const data = rec ? await ctx.files.get(auth.companyId, id) : null;
    if (!rec || !data) return res.status(404).end();
    res.setHeader("Content-Type", rec.data.mime);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(data);
  });

  // Body parser errors (too large) end up here.
  r.use((err: { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "too_large" });
    return res.status(400).json({ error: "bad_request" });
  });
  return r;
}
