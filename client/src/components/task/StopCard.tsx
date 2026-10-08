import { useState } from "react";
import { OctagonAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import type { TaskView } from "@/lib/types";
import { Button } from "../ui/Button";
import { TextArea } from "../ui/Fields";
import { InlineError } from "../ui/States";

/** Muster E - never looks like a crash, never ends with a fake success. */
export function StopCard({ task, onChanged }: { task: TaskView; onChanged: () => void }) {
  const { t } = useLanguage();
  const base = useBase();
  const [note, setNote] = useState("");
  const resolve = trpc.tasks.resolve.useMutation({ onSuccess: () => (base.reset(), setNote(""), onChanged()) });
  const b = task.data.blocker;
  if (!b) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-stop bg-white p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-stop">
        <OctagonAlert aria-hidden />
        {t("task.stop.title")}
      </h2>
      <div>
        <p className="text-sm text-slate-600">{t("task.stop.what")}</p>
        <p className="font-semibold">{t(`block.${b.reason}`)}</p>
        <p className="whitespace-pre-wrap">{b.note}</p>
        {task.blockerName && <p className="text-sm text-slate-600">— {task.blockerName}</p>}
      </div>
      <p className="text-slate-700">{t("task.stop.unchanged")}</p>
      {!task.can.resolve && <p className="font-medium">{t("task.stop.who")}</p>}
      {task.can.resolve && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <TextArea label={t("task.resolve.note")} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          <InlineError error={resolve.error} />
          <Button block disabled={!note.trim()} loading={resolve.isPending} onClick={() => resolve.mutate(base({ taskId: task.id, version: task.version, decision: "resume", note }))}>
            {t("task.resolve.resume")}
          </Button>
          <Button block variant="stop" disabled={!note.trim()} loading={resolve.isPending} onClick={() => resolve.mutate(base({ taskId: task.id, version: task.version, decision: "cancel", note }))}>
            {t("task.resolve.cancel")}
          </Button>
        </div>
      )}
    </section>
  );
}
