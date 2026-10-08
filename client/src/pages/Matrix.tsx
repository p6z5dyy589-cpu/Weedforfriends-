import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { WorkType } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase, useHasRole } from "@/hooks/useMe";
import { Card, PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { ErrorState, InlineError, Loading } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { PersonSelect } from "@/components/PersonSelect";

const MAX_DEPUTIES = 3;

interface Entry {
  workType: WorkType;
  version: number;
  primaryUserId: number | null;
  deputyUserIds: number[];
}

function MatrixCard({ entry, canEdit }: { entry: Entry; canEdit: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const utils = trpc.useUtils();
  const base = useBase();
  const [primary, setPrimary] = useState<number | null>(entry.primaryUserId);
  const [deputies, setDeputies] = useState<(number | null)[]>(entry.deputyUserIds);
  const save = trpc.coordination.setMatrix.useMutation({
    onSuccess: () => {
      base.reset();
      toast(t("app.saved"));
      void utils.coordination.matrix.invalidate();
    },
    onError: () => void utils.coordination.matrix.invalidate(),
  });

  const cleanDeputies = deputies.filter((d): d is number => d !== null);
  const dirty = primary !== entry.primaryUserId || JSON.stringify(cleanDeputies) !== JSON.stringify(entry.deputyUserIds);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t(`work.${entry.workType}`)}</h2>
      <fieldset disabled={!canEdit || save.isPending} className="flex flex-col gap-3">
        <PersonSelect label={t("admin.matrix.primary")} value={primary} onChange={setPrimary} />
        {deputies.map((d, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <PersonSelect label={t("admin.matrix.deputy", { n: i + 1 })} value={d} onChange={(v) => setDeputies((cur) => cur.map((x, j) => (j === i ? v : x)))} />
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                className="px-3"
                aria-label={t("admin.matrix.removeDeputy", { n: i + 1 })}
                icon={<Trash2 className="size-5" aria-hidden />}
                onClick={() => setDeputies((cur) => cur.filter((_, j) => j !== i))}
              />
            )}
          </div>
        ))}
        {canEdit && deputies.length < MAX_DEPUTIES && (
          <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => setDeputies((cur) => [...cur, null])}>
            {t("admin.matrix.addDeputy")}
          </Button>
        )}
      </fieldset>
      <InlineError error={save.error} />
      {canEdit && (
        <>
          {dirty && <p className="text-sm font-medium text-amber-800">{t("admin.matrix.unsaved")}</p>}
          <Button
            block
            disabled={!dirty}
            loading={save.isPending}
            onClick={() => save.mutate(base({ workType: entry.workType, version: entry.version, primaryUserId: primary, deputyUserIds: cleanDeputies }))}
          >
            {t("app.save")}
          </Button>
        </>
      )}
    </Card>
  );
}

/** Zuständigkeiten: suggestion matrix for substitutions only. */
export default function Matrix() {
  const { t } = useLanguage();
  const canEdit = useHasRole("coordinator");
  const matrix = trpc.coordination.matrix.useQuery();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("nav.item.matrix")} coordination />
      <p className="rounded-lg bg-slate-100 p-3 text-sm font-medium">{t("admin.matrix.note")}</p>
      {!canEdit && <p className="text-sm font-medium text-slate-700">{t("admin.readOnly")}</p>}
      {matrix.isLoading ? (
        <Loading />
      ) : matrix.error || !matrix.data ? (
        <ErrorState error={matrix.error} onRetry={() => matrix.refetch()} />
      ) : (
        // Keyed by version: a saved or newer server state resets the card's local edits.
        matrix.data.map((e) => <MatrixCard key={`${e.workType}:${e.version}`} entry={e} canEdit={canEdit} />)
      )}
    </div>
  );
}
