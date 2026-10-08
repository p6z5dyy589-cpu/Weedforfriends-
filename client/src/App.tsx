import { Route, Switch, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import MobileShell from "@/components/MobileShell";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import { StatusMessage } from "@/components/StatusMessage";

export default function App() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const me = trpc.auth.me.useQuery();

  if (me.isLoading) return <StatusMessage text={t("app.loading")} />;
  if (me.error?.data?.code === "UNAUTHORIZED") {
    return <Login onLoggedIn={() => queryClient.resetQueries()} />;
  }
  if (me.error || !me.data) {
    return <StatusMessage text={t("app.error")} actionLabel={t("app.retry")} onAction={() => me.refetch()} />;
  }

  return (
    <MobileShell me={me.data}>
      <Switch>
        <Route path="/">
          <Home activeCompanyId={me.data.activeCompanyId} />
        </Route>
        <Route>
          <div className="p-4 text-center">
            <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
            <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-white">
              {t("notFound.back")}
            </Link>
          </div>
        </Route>
      </Switch>
    </MobileShell>
  );
}
