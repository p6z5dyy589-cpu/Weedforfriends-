import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { UNITS, type MaterialLine, type Unit } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import type { TaskView } from "@/lib/types";
import { Button } from "../ui/Button";
import { CheckRow, NumberInput, SelectInput, TextArea, TextInput } from "../ui/Fields";
import { InlineError } from "../ui/States";

type Line = Omit<MaterialLine, "id" | "source">;

/**
 * Material/lot lines, output and 0-Verschnitt. The worker reports from the
 * paper sheet; the reviewer corrects in the same form (marked as such).
 */
export function WorkForm({ task, onSaved, reviewer }: { task: TaskView; onSaved: () => void; reviewer?: boolean }) {
  const { t } = useLanguage();
  const base = useBase();
  const d = task.data;
  const [lines, setLines] = useState<Line[]>(d.material.map(({ component, lot, quantity, unit }) => ({ component, lot, quantity, unit })));
  const [output, setOutput] = useState<number | null>(d.outputQuantity);
  const [zeroWaste, setZeroWaste] = useState(d.zeroWaste);
  const [note, setNote] = useState(d.workerNote);
  const save = trpc.tasks.saveWork.useMutation({ onSuccess: () => (base.reset(), onSaved()) });
  const dirty =
    JSON.stringify(lines) !== JSON.stringify(d.material.map(({ component, lot, quantity, unit }) => ({ component, lot, quantity, unit }))) ||
    output !== d.outputQuantity ||
    zeroWaste !== d.zeroWaste ||
    note !== d.workerNote;

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid = lines.every((l) => l.component.trim().length > 0);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(base({ taskId: task.id, version: task.version, material: lines, outputQuantity: output, zeroWaste, workerNote: note }));
      }}
    >
      <h3 className="font-semibold">{t("task.material")}</h3>
      {lines.map((l, i) => (
        <fieldset key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm text-slate-500">#{i + 1}</legend>
          <TextInput label={t("task.material.component")} value={l.component} maxLength={120} onChange={(e) => update(i, { component: e.target.value })} required />
          <TextInput label={t("task.material.lot")} value={l.lot} maxLength={64} onChange={(e) => update(i, { lot: e.target.value })} autoCapitalize="characters" />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label={t("task.material.quantity")} value={l.quantity} onChange={(v) => update(i, { quantity: v })} />
            <SelectInput label={t("task.material.unit")} value={l.unit} onChange={(e) => update(i, { unit: e.target.value as Unit })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`unit.${u}`)}
                </option>
              ))}
            </SelectInput>
          </div>
          <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
            {t("task.material.remove")}
          </Button>
        </fieldset>
      ))}
      <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setLines((ls) => [...ls, { component: "", lot: "", quantity: null, unit: task.data.unit }])} disabled={lines.length >= 40}>
        {t("task.material.add")}
      </Button>
      <NumberInput label={`${t("task.output")} (${t(`unit.${d.unit}`)})`} value={zeroWaste ? null : output} disabled={zeroWaste} onChange={setOutput} />
      <CheckRow label={t("task.zeroWaste")} checked={zeroWaste} onChange={(v) => (setZeroWaste(v), v && setOutput(null))} />
      {!reviewer && <TextArea label={t("task.workerNote")} hint={t("app.optional")} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />}
      <InlineError error={save.error} />
      <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty || !valid} loading={save.isPending}>
        {t("task.saveWork")}
      </Button>
    </form>
  );
}

export function MaterialSummary({ task }: { task: TaskView }) {
  const { t } = useLanguage();
  const d = task.data;
  return (
    <div className="flex flex-col gap-2">
      {d.material.length === 0 && <p className="text-slate-600">{t("reason.material_missing")}</p>}
      <ul className="flex flex-col gap-2">
        {d.material.map((l) => (
          <li key={l.id} className="rounded-xl border border-slate-200 p-3">
            <p className="font-medium">{l.component}</p>
            <p className={l.lot ? "text-slate-700" : "font-medium text-stop"}>
              {t("task.material.lot")}: {l.lot || t("reason.lot_missing")}
            </p>
            <p className="text-slate-700">
              {l.quantity === null ? <span className="font-medium text-stop">{t("reason.quantity_missing")}</span> : `${l.quantity} ${t(`unit.${l.unit}`)}`}
            </p>
            {l.source === "reviewer" && <p className="text-sm text-indigo-700">{t("task.material.byReviewer")}</p>}
          </li>
        ))}
      </ul>
      <p>
        <span className="font-medium">{t("task.output")}:</span> {d.zeroWaste ? t("task.zeroWaste") : d.outputQuantity !== null ? `${d.outputQuantity} ${t(`unit.${d.unit}`)}` : "—"}
      </p>
      {d.workerNote && (
        <p>
          <span className="font-medium">{t("task.workerNote")}:</span> {d.workerNote}
        </p>
      )}
    </div>
  );
}
