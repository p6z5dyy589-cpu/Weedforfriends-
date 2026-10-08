import type { ReactNode } from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { canAccessPath } from "@shared/navigation";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { MeProvider, useMe } from "@/hooks/useMe";
import MobileShell from "@/components/MobileShell";
import { StatusMessage } from "@/components/StatusMessage";
import { ErrorState } from "@/components/ui/States";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import TaskDetail from "@/pages/TaskDetail";
import Workplace from "@/pages/Workplace";
import NewTask from "@/pages/NewTask";
import ReviewList from "@/pages/ReviewList";
import Packing from "@/pages/Packing";
import Incoming from "@/pages/Incoming";
import Planning from "@/pages/Planning";
import Control from "@/pages/Control";
import Team from "@/pages/Team";
import Matrix from "@/pages/Matrix";
import People from "@/pages/People";
import Notifications from "@/pages/Notifications";
import ChatList from "@/pages/ChatList";
import ChatRoom from "@/pages/ChatRoom";
import WarehouseMap from "@/pages/WarehouseMap";

/** Client-side visibility only; the server enforces every permission again. */
function Guard({ path, children }: { path: string; children: ReactNode }) {
  const me = useMe();
  if (!canAccessPath(path, me.roles)) return <ErrorState error={{ data: { code: "FORBIDDEN" } }} />;
  return <>{children}</>;
}

function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="p-4 text-center">
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-white">
        {t("notFound.back")}
      </Link>
    </div>
  );
}

const guarded: [string, () => ReactNode][] = [
  ["/arbeitsplatz", () => <Workplace />],
  ["/aufgabe-neu", () => <NewTask />],
  ["/pruefung", () => <ReviewList />],
  ["/packen", () => <Packing />],
  ["/wareneingang", () => <Incoming />],
  ["/planung", () => <Planning />],
  ["/leitstand", () => <Control />],
  ["/team", () => <Team />],
  ["/zustaendigkeiten", () => <Matrix />],
  ["/personen", () => <People />],
  ["/nachrichten", () => <Notifications />],
  ["/chat", () => <ChatList />],
  ["/lagerkarte", () => <WarehouseMap />],
];

export default function App() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const me = trpc.auth.me.useQuery();
  const [, navigate] = useLocation();

  if (me.isLoading) return <StatusMessage text={t("app.loading")} />;
  if (me.error?.data?.code === "UNAUTHORIZED") {
    return (
      <Login
        onLoggedIn={() => {
          navigate("/");
          void queryClient.resetQueries();
        }}
      />
    );
  }
  if (me.error || !me.data) {
    return <StatusMessage text={t("app.error")} actionLabel={t("app.retry")} onAction={() => me.refetch()} />;
  }

  return (
    <MeProvider me={me.data}>
      {/* key: a company switch remounts everything - no state of the old company survives. */}
      <MobileShell key={me.data.activeCompanyId}>
        <Switch>
          <Route path="/">
            <Home />
          </Route>
          <Route path="/aufgabe/:id">{(p) => <TaskDetail id={p.id} />}</Route>
          <Route path="/chat/:id">{(p) => <ChatRoom id={decodeURIComponent(p.id)} />}</Route>
          {guarded.map(([path, render]) => (
            <Route key={path} path={path}>
              <Guard path={path}>{render()}</Guard>
            </Route>
          ))}
          <Route>
            <NotFound />
          </Route>
        </Switch>
      </MobileShell>
    </MeProvider>
  );
}
