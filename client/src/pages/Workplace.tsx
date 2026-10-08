import { useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHasRole } from "@/hooks/useMe";
import type { TranslationKey } from "@/i18n";
import { PageHeader, Tabs } from "@/components/ui/Layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { LocalBadge } from "@/components/ui/StatusBadge";
import { TaskRows } from "@/components/TaskRow";

type Tab = "mine" | "team" | "blocked" | "ready";
const TABS: readonly Tab[] = ["mine", "team", "blocked", "ready"];

const LABEL: Record<Tab, TranslationKey> = {
  mine: "flow.workplace.mine",
  team: "flow.workplace.team",
  blocked: "flow.workplace.blocked",
  ready: "flow.workplace.ready",
};
const EMPTY: Record<Tab, TranslationKey> = {
  mine: "flow.workplace.empty.mine",
  team: "flow.workplace.empty.team",
  blocked: "flow.workplace.empty.blocked",
  ready: "flow.workplace.empty.ready",
};

/** Arbeitsplatz: own work, team, blocked and ready-to-ship lists. */
export default function Workplace() {
  const { t } = useLanguage();
  const search = useSearch();
  const showTeam = useHasRole("coordinator", "planner", "reviewer", "qm");
  const fromUrl = new URLSearchParams(search).get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(fromUrl && TABS.includes(fromUrl) && (fromUrl !== "team" || showTeam) ? fromUrl : "mine");

  const queries = {
    mine: trpc.tasks.list.useQuery({ scope: "mine" }),
    team: trpc.tasks.list.useQuery({ scope: "team" }, { enabled: showTeam }),
    blocked: trpc.tasks.list.useQuery({ scope: "blocked" }),
    ready: trpc.tasks.list.useQuery({ scope: "ready" }),
  };
  const visible = TABS.filter((v) => v !== "team" || showTeam);
  const active = queries[tab];

  return (
    <div className="flex flex-col">
      <PageHeader title={t("nav.item.workplace")}>
        <LocalBadge />
      </PageHeader>
      <Tabs value={tab} onChange={setTab} options={visible.map((v) => ({ value: v, label: t(LABEL[v]), count: queries[v].data?.length }))} />
      {tab === "ready" && <p className="mb-3 text-sm font-medium text-slate-700">{t("flow.workplace.readyHint")}</p>}
      {active.isLoading ? (
        <Loading />
      ) : active.error || !active.data ? (
        <ErrorState error={active.error} onRetry={() => active.refetch()} />
      ) : active.data.length === 0 ? (
        <EmptyState text={t(EMPTY[tab])} />
      ) : (
        <TaskRows tasks={active.data} />
      )}
    </div>
  );
}
