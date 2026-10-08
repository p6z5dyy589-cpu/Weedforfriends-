import { useState } from "react";
import { Copy } from "lucide-react";
import { slackOutText } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase, useMe } from "@/hooks/useMe";
import type { TaskView } from "@/lib/types";
import { useToast } from "../ui/Toast";
import { Button } from "../ui/Button";
import { CheckRow, TextArea } from "../ui/Fields";
import { Sheet } from "../ui/Sheet";
import { InlineError } from "../ui/States";

/** Offer → accept (two separate events) → check every line → packed locally. */
export function PackingPanel({ task, onChanged }: { task: TaskView; onChanged: () => void }) {
  const { t, tx } = useLanguage();
  const me = useMe();
  const base = useBase();
  const toast = useToast();
  const [deviationFor, setDeviationFor] = useState<string | "accept" | null>(null);
  const [deviation, setDeviation] = useState("");
  const done = () => (base.reset(), setDeviationFor(null), setDeviation(""), onChanged());
  const offer = trpc.tasks.offer.useMutation({ onSuccess: done });
  const accept = trpc.tasks.accept.useMutation({ onSuccess: done });
  const check = trpc.tasks.checkLine.useMutation({ onSuccess: done });
  const complete = trpc.tasks.completePacking.useMutation({ onSuccess: done });
  const d = task.data;
  const error = offer.error ?? accept.error ?? check.error ?? complete.error;
  const company = me.companies.find((c) => c.id === task.companyId)?.name ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(slackOutText(d, company));
      toast(t("task.slackOutCopied"));
    } catch {
      // clipboard unavailable - text stays visible below
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{t("task.packlist")}</h3>
      <ul className="flex flex-col gap-2">
        {d.packLines.map((l) => (
          <li key={l.id} className="flex flex-col gap-2">
            {task.can.checkLines ? (
              <CheckRow
                label={`${l.product} · ${l.quantity} ${t(`unit.${l.unit}`)}`}
                description={[l.lotInfo && `${t("task.lotInfo")}: ${l.lotInfo}`, l.deviation && `${t("task.deviation")}: ${l.deviation}`].filter(Boolean).join(" · ") || undefined}
                checked={l.checked}
                disabled={check.isPending || !!l.deviation}
                onChange={(v) => check.mutate(base({ taskId: task.id, version: task.version, lineId: l.id, checked: v, deviation: null }))}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="font-medium">
                  {l.checked ? "✓ " : ""}
                  {l.product} · {l.quantity} {t(`unit.${l.unit}`)}
                </p>
                {l.lotInfo && <p className="text-sm text-slate-600">{t("task.lotInfo")}: {l.lotInfo}</p>}
                {l.deviation && <p className="text-sm font-medium text-stop">{t("task.deviation")}: {l.deviation}</p>}
              </div>
            )}
            {task.can.checkLines &&
              (l.deviation ? (
                <Button variant="secondary" onClick={() => check.mutate(base({ taskId: task.id, version: task.version, lineId: l.id, checked: false, deviation: null }))}>
                  {t("task.packLine.clearDeviation")}
                </Button>
              ) : (
                <Button variant="ghost" className="text-stop" onClick={() => setDeviationFor(l.id)}>
                  {t("task.packLine.deviation")}
                </Button>
              ))}
          </li>
        ))}
      </ul>
      <InlineError error={error} />

      {task.can.offer && (
        <Button block loading={offer.isPending} onClick={() => offer.mutate(base({ taskId: task.id, version: task.version }))}>
          {t("task.offer")}
        </Button>
      )}
      {d.status === "handover_offered" && !task.can.accept && <p className="font-medium text-amber-800">{t("task.offered")}</p>}
      {task.can.accept && (
        <>
          <Button block loading={accept.isPending} onClick={() => accept.mutate(base({ taskId: task.id, version: task.version, deviation: null }))}>
            {t("task.accept")}
          </Button>
          <Button block variant="stop" onClick={() => setDeviationFor("accept")}>
            {t("task.acceptDeviation")}
          </Button>
        </>
      )}
      {task.can.checkLines && (
        <>
          {task.checks.completePacking && task.checks.completePacking !== "wrong_status" && <p className="text-slate-700">{tx(`reason.${task.checks.completePacking}`, "app.error")}</p>}
          <Button block disabled={!task.can.completePacking} loading={complete.isPending} onClick={() => complete.mutate(base({ taskId: task.id, version: task.version }))}>
            {t("task.completePacking")}
          </Button>
        </>
      )}
      {d.status === "packed" && (
        <div className="flex flex-col gap-2">
          <pre className="whitespace-pre-wrap rounded-xl bg-slate-100 p-3 text-sm">{slackOutText(d, company)}</pre>
          <Button variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => void copy()}>
            {t("task.slackOut")}
          </Button>
        </div>
      )}

      <Sheet open={deviationFor !== null} onOpenChange={(o) => !o && setDeviationFor(null)} title={deviationFor === "accept" ? t("task.acceptDeviation") : t("task.packLine.deviation")}>
        <TextArea label={t("task.deviation")} hint={t("task.deviationHint")} value={deviation} maxLength={500} onChange={(e) => setDeviation(e.target.value)} />
        <InlineError error={accept.error ?? check.error} />
        <Button
          block
          variant="danger"
          disabled={!deviation.trim()}
          loading={accept.isPending || check.isPending}
          onClick={() =>
            deviationFor === "accept"
              ? accept.mutate(base({ taskId: task.id, version: task.version, deviation }))
              : check.mutate(base({ taskId: task.id, version: task.version, lineId: deviationFor!, checked: false, deviation }))
          }
        >
          {t("task.report.send")}
        </Button>
      </Sheet>
    </div>
  );
}
