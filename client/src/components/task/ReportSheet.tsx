import { useState } from "react";
import { BLOCK_REASONS, type BlockReason } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import type { TaskView } from "@/lib/types";
import { Button } from "../ui/Button";
import { SelectInput, TextArea } from "../ui/Fields";
import { Sheet } from "../ui/Sheet";
import { InlineError } from "../ui/States";

/** "Etwas passt nicht" - opens a clarification, changes nothing in Odoo. */
export function ReportSheet({ task, open, onOpenChange, onDone }: { task: TaskView; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { t } = useLanguage();
  const base = useBase();
  const [reason, setReason] = useState<BlockReason>("material");
  const [note, setNote] = useState("");
  const report = trpc.tasks.report.useMutation({ onSuccess: () => (base.reset(), setNote(""), onOpenChange(false), onDone()) });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("task.report.title")}>
      <SelectInput label={t("task.report.reason")} value={reason} onChange={(e) => setReason(e.target.value as BlockReason)}>
        {BLOCK_REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`block.${r}`)}
          </option>
        ))}
      </SelectInput>
      <TextArea label={t("task.report.note")} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      <p className="text-sm text-slate-600">{t("task.stop.unchanged")}</p>
      <InlineError error={report.error} />
      <Button block variant="danger" disabled={!note.trim()} loading={report.isPending} onClick={() => report.mutate(base({ taskId: task.id, version: task.version, reason, note }))}>
        {t("task.report.send")}
      </Button>
    </Sheet>
  );
}
