import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { PROCESS_TYPES, UNITS, WORK_TYPES, type ProcessType, type Unit, type WorkType } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase, useHasRole } from "@/hooks/useMe";
import { PersonSelect } from "@/components/PersonSelect";
import { Button } from "@/components/ui/Button";
import { CheckRow, NumberInput, SelectInput, TextInput } from "@/components/ui/Fields";
import { Card, PageHeader, Section, Tabs } from "@/components/ui/Layout";
import { InlineError } from "@/components/ui/States";
import { LocalBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

type Mode = "single" | "template";
const BULK_WORK_TYPES = ["flowers", "hash", "vapes"] as const;
type BulkWorkType = (typeof BULK_WORK_TYPES)[number];

interface PackLineDraft {
  key: number;
  product: string;
  quantity: number | null;
  unit: Unit;
  lotInfo: string;
}

function UnitSelect({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  const { t } = useLanguage();
  return (
    <SelectInput label={t("task.material.unit")} value={value} onChange={(e) => onChange(e.target.value as Unit)}>
      {UNITS.map((u) => (
        <option key={u} value={u}>
          {t(`unit.${u}`)}
        </option>
      ))}
    </SelectInput>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLanguage();
  return <TextInput label={t("task.plannedDate")} hint={t("app.optional")} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function SingleForm({ canPlan }: { canPlan: boolean }) {
  const { t } = useLanguage();
  const base = useBase();
  const utils = trpc.useUtils();
  const toast = useToast();
  const [, navigate] = useLocation();
  const processTypes: readonly ProcessType[] = canPlan ? PROCESS_TYPES : ["incoming"];

  const [processType, setProcessType] = useState<ProcessType>(canPlan ? "production" : "incoming");
  const [workType, setWorkType] = useState<WorkType | null>(null);
  const [reference, setReference] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit>("pcs");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [plannedDate, setPlannedDate] = useState("");
  const [lines, setLines] = useState<PackLineDraft[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [qualityPhotoRequired, setQualityPhotoRequired] = useState(false);
  const [containerSize, setContainerSize] = useState("");
  const [tried, setTried] = useState(false);

  const create = trpc.tasks.create.useMutation({
    onSuccess: (res) => {
      base.reset();
      utils.tasks.invalidate();
      utils.today.invalidate();
      toast(t("flow.new.created"));
      navigate(`/aufgabe/${res.id}`);
    },
  });

  const isPacking = processType === "packing";
  const isIncoming = processType === "incoming";
  const linesValid = !isPacking || lines.every((l) => l.product.trim() && l.quantity !== null && l.quantity > 0);
  const valid = reference.trim() !== "" && product.trim() !== "" && (quantity === null || quantity > 0) && linesValid;

  const updateLine = (key: number, patch: Partial<PackLineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => {
    setLines((ls) => [...ls, { key: nextKey, product: product.trim(), quantity: null, unit, lotInfo: "" }]);
    setNextKey((k) => k + 1);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    create.mutate(
      base({
        processType,
        workType,
        reference: reference.trim(),
        product: product.trim(),
        quantity,
        unit,
        assigneeId,
        plannedDate: plannedDate || null,
        packLines: isPacking ? lines.map((l) => ({ product: l.product.trim(), quantity: l.quantity as number, unit: l.unit, lotInfo: l.lotInfo.trim() })) : [],
        qualityPhotoRequired: isIncoming ? qualityPhotoRequired : false,
        containerSize: isIncoming ? containerSize.trim() : "",
      }),
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        {!canPlan && <p className="text-sm text-slate-600">{t("flow.new.onlyIncoming")}</p>}
        <SelectInput label={t("flow.new.processType")} value={processType} onChange={(e) => setProcessType(e.target.value as ProcessType)} disabled={processTypes.length === 1}>
          {processTypes.map((p) => (
            <option key={p} value={p}>
              {t(`process.${p}`)}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label={t("flow.new.workType")}
          hint={t("app.optional")}
          value={workType ?? ""}
          onChange={(e) => setWorkType(e.target.value === "" ? null : (e.target.value as WorkType))}
        >
          <option value="">{t("app.none")}</option>
          {WORK_TYPES.map((w) => (
            <option key={w} value={w}>
              {t(`work.${w}`)}
            </option>
          ))}
        </SelectInput>
        <TextInput label={t("task.reference")} value={reference} maxLength={64} required onChange={(e) => setReference(e.target.value)} />
        <TextInput label={t("task.product")} value={product} maxLength={120} required onChange={(e) => setProduct(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label={t("task.quantity")} hint={t("app.optional")} value={quantity} onChange={setQuantity} />
          <UnitSelect value={unit} onChange={setUnit} />
        </div>
        <PersonSelect label={t("flow.new.assignee")} value={assigneeId} onChange={setAssigneeId} />
        <DateInput value={plannedDate} onChange={setPlannedDate} />
      </Card>

      {isPacking && (
        <Section title={t("task.packlist")}>
          {lines.map((l, i) => (
            <Card key={l.key} className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-700">{t("flow.new.line", { n: i + 1 })}</p>
              <TextInput label={t("task.product")} value={l.product} maxLength={120} onChange={(e) => updateLine(l.key, { product: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label={t("task.quantity")} value={l.quantity} onChange={(v) => updateLine(l.key, { quantity: v })} />
                <UnitSelect value={l.unit} onChange={(u) => updateLine(l.key, { unit: u })} />
              </div>
              <TextInput label={t("task.lotInfo")} hint={t("app.optional")} value={l.lotInfo} maxLength={64} onChange={(e) => updateLine(l.key, { lotInfo: e.target.value })} />
              <Button variant="ghost" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                {t("flow.new.removeLine")}
              </Button>
            </Card>
          ))}
          {lines.length < 50 && (
            <Button variant="secondary" onClick={addLine}>
              {t("flow.new.addLine")}
            </Button>
          )}
        </Section>
      )}

      {isIncoming && (
        <Card className="flex flex-col gap-3">
          <CheckRow label={t("task.incoming.photoRequired")} checked={qualityPhotoRequired} onChange={setQualityPhotoRequired} />
          <TextInput label={t("task.incoming.container")} hint={t("app.optional")} value={containerSize} maxLength={40} onChange={(e) => setContainerSize(e.target.value)} />
          <p className="text-sm text-slate-600">{t("task.incoming.bookInOdoo")}</p>
        </Card>
      )}

      {tried && !valid && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-stop">{t("flow.new.fillRequired")}</p>}
      <InlineError error={create.error} />
      <Button type="submit" block loading={create.isPending}>
        {t("flow.new.create")}
      </Button>
    </form>
  );
}

function TemplateForm() {
  const { t } = useLanguage();
  const base = useBase();
  const utils = trpc.useUtils();
  const toast = useToast();
  const [, navigate] = useLocation();

  const [reference, setReference] = useState("");
  const [bulkProduct, setBulkProduct] = useState("");
  const [bulkQuantity, setBulkQuantity] = useState<number | null>(null);
  const [bulkUnit, setBulkUnit] = useState<Unit>("g");
  const [bulkWorkType, setBulkWorkType] = useState<BulkWorkType>("flowers");
  const [endProduct, setEndProduct] = useState("");
  const [endQuantity, setEndQuantity] = useState<number | null>(null);
  const [endUnit, setEndUnit] = useState<Unit>("pcs");
  const [bulkAssigneeId, setBulkAssigneeId] = useState<number | null>(null);
  const [packagingAssigneeId, setPackagingAssigneeId] = useState<number | null>(null);
  const [packAssigneeId, setPackAssigneeId] = useState<number | null>(null);
  const [plannedDate, setPlannedDate] = useState("");
  const [tried, setTried] = useState(false);

  const createChain = trpc.tasks.createChain.useMutation({
    onSuccess: () => {
      base.reset();
      utils.tasks.invalidate();
      utils.today.invalidate();
      toast(t("flow.tpl.created"));
      navigate("/arbeitsplatz");
    },
  });

  const valid =
    reference.trim() !== "" &&
    bulkProduct.trim() !== "" &&
    endProduct.trim() !== "" &&
    endQuantity !== null &&
    endQuantity > 0 &&
    (bulkQuantity === null || bulkQuantity > 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid || endQuantity === null) return;
    createChain.mutate(
      base({
        reference: reference.trim(),
        bulkProduct: bulkProduct.trim(),
        bulkQuantity,
        bulkUnit,
        bulkWorkType,
        endProduct: endProduct.trim(),
        endQuantity,
        endUnit,
        bulkAssigneeId,
        packagingAssigneeId,
        packAssigneeId,
        plannedDate: plannedDate || null,
      }),
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="rounded-lg border border-dashed border-slate-400 bg-white p-3 text-sm font-medium text-slate-700">{t("flow.tpl.hint")}</p>
      <Card className="flex flex-col gap-4">
        <TextInput label={t("task.reference")} value={reference} maxLength={64} required onChange={(e) => setReference(e.target.value)} />
        <DateInput value={plannedDate} onChange={setPlannedDate} />
      </Card>
      <Section title={t("flow.tpl.bulk")}>
        <Card className="flex flex-col gap-4">
          <SelectInput label={t("flow.tpl.bulkWorkType")} value={bulkWorkType} onChange={(e) => setBulkWorkType(e.target.value as BulkWorkType)}>
            {BULK_WORK_TYPES.map((w) => (
              <option key={w} value={w}>
                {t(`work.${w}`)}
              </option>
            ))}
          </SelectInput>
          <TextInput label={t("flow.tpl.bulkProduct")} value={bulkProduct} maxLength={120} required onChange={(e) => setBulkProduct(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label={t("flow.tpl.bulkQuantity")} hint={t("app.optional")} value={bulkQuantity} onChange={setBulkQuantity} />
            <UnitSelect value={bulkUnit} onChange={setBulkUnit} />
          </div>
        </Card>
      </Section>
      <Section title={t("flow.tpl.end")}>
        <Card className="flex flex-col gap-4">
          <TextInput label={t("flow.tpl.endProduct")} value={endProduct} maxLength={120} required onChange={(e) => setEndProduct(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label={t("flow.tpl.endQuantity")} value={endQuantity} required onChange={setEndQuantity} />
            <UnitSelect value={endUnit} onChange={setEndUnit} />
          </div>
        </Card>
      </Section>
      <Section title={t("flow.tpl.people")}>
        <Card className="flex flex-col gap-4">
          <PersonSelect label={t("flow.tpl.bulkAssignee")} value={bulkAssigneeId} onChange={setBulkAssigneeId} />
          <PersonSelect label={t("flow.tpl.packagingAssignee")} value={packagingAssigneeId} onChange={setPackagingAssigneeId} />
          <PersonSelect label={t("flow.tpl.packAssignee")} value={packAssigneeId} onChange={setPackAssigneeId} />
        </Card>
      </Section>
      {tried && !valid && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-stop">{t("flow.new.fillRequired")}</p>}
      <InlineError error={createChain.error} />
      <Button type="submit" block loading={createChain.isPending}>
        {t("flow.tpl.create")}
      </Button>
    </form>
  );
}

/** Neue Aufgabe (coordination): a single local task or the local WFF/Ketama template. */
export default function NewTask() {
  const { t } = useLanguage();
  const canPlan = useHasRole("planner", "coordinator", "reviewer");
  const [mode, setMode] = useState<Mode>("single");
  const modes: { value: Mode; label: string }[] = [
    { value: "single", label: t("flow.new.single") },
    ...(canPlan ? [{ value: "template" as const, label: t("flow.new.template") }] : []),
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title={t("nav.item.newTask")} coordination>
        <LocalBadge />
      </PageHeader>
      {modes.length > 1 && <Tabs value={mode} onChange={setMode} options={modes} />}
      {mode === "template" && canPlan ? <TemplateForm /> : <SingleForm canPlan={canPlan} />}
    </div>
  );
}
