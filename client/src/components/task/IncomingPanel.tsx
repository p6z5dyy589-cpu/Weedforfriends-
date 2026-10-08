import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import type { TaskView } from "@/lib/types";
import { Button } from "../ui/Button";
import { TextInput, YesNo } from "../ui/Fields";
import { InlineError } from "../ui/States";
import { PhotoEditor, PhotoGallery } from "./Photos";

/** Ware angekommen → prüfen. Booking stays a deliberate Odoo step. */
export function IncomingPanel({ task, onChanged }: { task: TaskView; onChanged: () => void }) {
  const { t, tx } = useLanguage();
  const base = useBase();
  const inc = task.data.incoming!;
  const [container, setContainer] = useState(inc.containerSize);
  const save = trpc.tasks.saveIncoming.useMutation({ onSuccess: () => (base.reset(), onChanged()) });
  const complete = trpc.tasks.completeIncoming.useMutation({ onSuccess: () => (base.reset(), onChanged()) });
  const edit = task.can.editIncoming;
  const set = (patch: { deliveryNoteMatches?: boolean; quantityMatches?: boolean; containerSize?: string }) =>
    save.mutate(
      base({
        taskId: task.id,
        version: task.version,
        deliveryNoteMatches: patch.deliveryNoteMatches ?? inc.deliveryNoteMatches,
        quantityMatches: patch.quantityMatches ?? inc.quantityMatches,
        containerSize: patch.containerSize ?? container,
      }),
    );

  return (
    <div className="flex flex-col gap-4">
      <YesNo label={t("task.incoming.deliveryNote")} value={inc.deliveryNoteMatches} disabled={!edit || save.isPending} yes={t("task.yes")} no={t("task.no")} onChange={(v) => set({ deliveryNoteMatches: v })} />
      <YesNo label={t("task.incoming.quantity")} value={inc.quantityMatches} disabled={!edit || save.isPending} yes={t("task.yes")} no={t("task.no")} onChange={(v) => set({ quantityMatches: v })} />
      <TextInput label={t("task.incoming.container")} hint={t("app.optional")} value={container} disabled={!edit} maxLength={40} onChange={(e) => setContainer(e.target.value)} onBlur={() => container !== inc.containerSize && set({ containerSize: container })} />
      <div>
        <h3 className="mb-2 font-semibold">
          {t("task.photos")}
          {inc.qualityPhotoRequired && <span className="ml-2 text-sm font-normal text-amber-800">({t("task.incoming.photoRequired")})</span>}
        </h3>
        {task.can.addPhoto ? <PhotoEditor taskId={task.id} version={task.version} fileIds={task.data.photoFileIds} onChanged={onChanged} /> : <PhotoGallery fileIds={task.data.photoFileIds} />}
      </div>
      <InlineError error={save.error ?? complete.error} />
      {edit && (
        <>
          {task.checks.completeIncoming && task.checks.completeIncoming !== "wrong_status" && <p className="text-slate-700">{tx(`reason.${task.checks.completeIncoming}`, "app.error")}</p>}
          <Button block disabled={!task.can.completeIncoming} loading={complete.isPending} onClick={() => complete.mutate(base({ taskId: task.id, version: task.version }))}>
            {t("task.incoming.complete")}
          </Button>
        </>
      )}
      <p className="text-sm text-slate-600">{t("task.incoming.bookInOdoo")}</p>
    </div>
  );
}
