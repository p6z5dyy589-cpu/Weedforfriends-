import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import type { TaskView } from "@/lib/types";
import { Button } from "../ui/Button";
import { TextArea } from "../ui/Fields";
import { Card } from "../ui/Layout";
import { InlineError } from "../ui/States";
import { PhotoGallery } from "./Photos";
import { MaterialSummary, WorkForm } from "./WorkForm";

/** Muster C - Prüfblatt: reported / recognised / to check in Odoo / deviations, then one decision. */
export function ReviewSheet({ task, onDone }: { task: TaskView; onDone: () => void }) {
  const { t } = useLanguage();
  const base = useBase();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const review = trpc.tasks.review.useMutation({ onSuccess: () => (base.reset(), onDone()) });
  const d = task.data;
  const missing = [
    d.material.length === 0 && t("reason.material_missing"),
    d.material.some((l) => !l.lot) && t("reason.lot_missing"),
    d.material.some((l) => l.quantity === null) && t("reason.quantity_missing"),
    d.outputQuantity === null && !d.zeroWaste && t("reason.output_missing"),
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-2 font-semibold">{t("task.review.reported")}</h3>
        <PhotoGallery fileIds={d.photoFileIds} />
        <div className="mt-3">{editing ? <WorkForm task={task} reviewer onSaved={() => (setEditing(false), onDone())} /> : <MaterialSummary task={task} />}</div>
        {task.can.editWork && !editing && (
          <Button variant="secondary" className="mt-3" onClick={() => setEditing(true)}>
            {t("task.review.correct")}
          </Button>
        )}
      </Card>
      <Card>
        <h3 className="mb-1 font-semibold">{t("task.review.odoo")}</h3>
        <p className="text-slate-700">{t("task.review.odooHint")}</p>
      </Card>
      {missing.length > 0 && (
        <Card className="border-2 border-stop">
          <h3 className="mb-1 font-semibold text-stop">{t("task.review.deviation")}</h3>
          <ul className="list-inside list-disc text-stop">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Card>
      )}
      <TextArea label={t("task.review.note")} hint={t("app.optional")} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      <InlineError error={review.error} />
      <div className="flex flex-col gap-2">
        <Button block disabled={missing.length > 0 || editing} loading={review.isPending} onClick={() => review.mutate(base({ taskId: task.id, version: task.version, decision: "approved", note }))}>
          {t("task.review.approve")}
        </Button>
        <Button block variant="secondary" disabled={!note.trim() || editing} loading={review.isPending} onClick={() => review.mutate(base({ taskId: task.id, version: task.version, decision: "returned", note }))}>
          {t("task.review.return")}
        </Button>
      </div>
    </div>
  );
}
