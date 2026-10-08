import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CompanyId } from "@shared/companies";

/** Binary storage for proof photos. Metadata lives in local records (kind "file"). */
export interface FileStore {
  put(companyId: CompanyId, id: string, data: Buffer): Promise<void>;
  get(companyId: CompanyId, id: string): Promise<Buffer | null>;
}

export class MemoryFileStore implements FileStore {
  files = new Map<string, Buffer>();
  async put(companyId: CompanyId, id: string, data: Buffer) {
    this.files.set(`${companyId}/${id}`, Buffer.from(data));
  }
  async get(companyId: CompanyId, id: string) {
    return this.files.get(`${companyId}/${id}`) ?? null;
  }
}

const SAFE_ID = /^[0-9a-f-]{36}$/;

/** Files are stored per company directory; ids are server-generated UUIDs. */
export class DiskFileStore implements FileStore {
  constructor(private readonly root: string) {}
  private file(companyId: CompanyId, id: string) {
    if (!SAFE_ID.test(id)) throw new Error("invalid file id");
    return path.join(this.root, String(companyId), id);
  }
  async put(companyId: CompanyId, id: string, data: Buffer) {
    await mkdir(path.join(this.root, String(companyId)), { recursive: true });
    await writeFile(this.file(companyId, id), data, { flag: "wx" });
  }
  async get(companyId: CompanyId, id: string) {
    try {
      return await readFile(this.file(companyId, id));
    } catch {
      return null;
    }
  }
}
