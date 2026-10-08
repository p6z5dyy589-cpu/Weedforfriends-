import type { CompanyId } from "@shared/companies";
import type { FileMeta } from "@shared/files";
import type { MemoryStore } from "../store/memoryStore";
import { createHarness } from "./harness";

/** Inserts a proof photo record as if the user had uploaded it. */
export function fakePhoto(store: MemoryStore, companyId: CompanyId, userId: number): string {
  const id = crypto.randomUUID();
  const now = new Date();
  store.records.set(id, {
    id,
    companyId,
    kind: "file",
    version: 1,
    ownerUserId: userId,
    parentId: null,
    data: { mime: "image/jpeg", size: 10, sha256: "x", uploadedBy: userId } satisfies FileMeta,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Standard team: Solovya (1) and Xenon (2). */
export async function teamHarness() {
  const h = await createHarness();
  const ids = {
    coord: await h.addUser({ loginName: "coord", grants: [[1, ["coordinator", "planner"]], [2, ["coordinator"]]] }),
    vincent: await h.addUser({ loginName: "vincent", grants: [[1, ["reviewer"]]] }),
    jakub: await h.addUser({ loginName: "jakub", grants: [[1, ["production"]]] }),
    hus: await h.addUser({ loginName: "hus", grants: [[1, ["production"]]] }),
    packer: await h.addUser({ loginName: "packer", grants: [[1, ["pack"]]] }),
    xenon: await h.addUser({ loginName: "xenon", grants: [[2, ["production"]]] }),
  };
  return { h, ids };
}
