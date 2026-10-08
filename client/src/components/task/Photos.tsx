import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase, useMe } from "@/hooks/useMe";
import { uuid } from "@/lib/uuid";
import { prepareImage, uploadPhoto, UploadError } from "@/lib/upload";
import { InlineError } from "../ui/States";

export function PhotoGallery({ fileIds }: { fileIds: string[] }) {
  if (fileIds.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {fileIds.map((id, i) => (
        <a key={id} href={`/api/files/${id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-slate-100">
          <img src={`/api/files/${id}`} alt={`Foto ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

/** Take/attach proof photos. Upload first, then attach to the task (two idempotent steps). */
export function PhotoEditor({ taskId, version, fileIds, onChanged }: { taskId: string; version: number; fileIds: string[]; onChanged: () => void }) {
  const { t } = useLanguage();
  const me = useMe();
  const base = useBase();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const add = trpc.tasks.addPhoto.useMutation({ onSuccess: () => (base.reset(), onChanged()) });
  const remove = trpc.tasks.removePhoto.useMutation({ onSuccess: () => (base.reset(), onChanged()) });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setBusy(true);
    try {
      const blob = await prepareImage(file);
      const fileId = await uploadPhoto(blob, uuid(), me.activeCompanyId);
      await add.mutateAsync(base({ taskId, version, fileId }));
    } catch (e) {
      if (e instanceof UploadError) {
        setUploadError(e.kind === "too_large" ? t("task.uploadTooLarge") : e.kind === "type" ? t("task.uploadType") : e.kind === "company_changed" ? t("error.companyChanged") : e.kind === "session" ? t("error.session") : t("task.uploadFailed"));
      }
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fileIds.map((id, i) => (
          <div key={id} className="relative overflow-hidden rounded-xl bg-slate-100">
            <img src={`/api/files/${id}`} alt={`Foto ${i + 1}`} className="aspect-square w-full object-cover" />
            <button
              type="button"
              aria-label={t("task.removePhoto")}
              disabled={remove.isPending}
              onClick={() => remove.mutate(base({ taskId, version, fileId: id }))}
              className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full bg-white/90 text-stop shadow"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} aria-label={t("task.addPhoto")} />
      <button
        type="button"
        disabled={busy || fileIds.length >= 10}
        onClick={() => input.current?.click()}
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-400 bg-white text-lg font-semibold text-slate-800 disabled:opacity-50"
      >
        <Camera aria-hidden />
        {busy ? t("task.uploading") : t("task.addPhoto")}
      </button>
      {uploadError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-stop">
          {uploadError}
        </p>
      )}
      <InlineError error={add.error ?? remove.error} />
    </div>
  );
}
