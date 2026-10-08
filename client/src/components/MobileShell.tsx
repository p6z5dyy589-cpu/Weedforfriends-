import type { ReactNode } from "react";
import { Bell, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMe } from "@/hooks/useMe";
import KioskQuickMenu from "./KioskQuickMenu";

function Badge({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-stop px-1 text-center text-xs font-bold leading-5 text-white">{count > 99 ? "99+" : count}</span>
  );
}

export default function MobileShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const me = useMe();
  const queryClient = useQueryClient();
  const switchCompany = trpc.auth.switchCompany.useMutation({
    // Drop every cached query so no data of the previous company survives.
    onSuccess: () => queryClient.resetQueries(),
  });
  const unreadNotes = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30_000 });
  const unreadChat = trpc.chat.unreadTotal.useQuery(undefined, { refetchInterval: 30_000 });
  const active = me.companies.find((c) => c.id === me.activeCompanyId);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-brand px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
        <KioskQuickMenu />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm opacity-80">{me.displayName}</p>
          {me.companies.length > 1 ? (
            <label className="flex items-center gap-2">
              <span className="sr-only">{t("company.switch")}</span>
              <select
                value={me.activeCompanyId}
                disabled={switchCompany.isPending}
                onChange={(e) => switchCompany.mutate({ companyId: Number(e.target.value) })}
                className="min-h-11 rounded-md bg-white/10 px-2 font-semibold"
              >
                {me.companies.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="font-semibold">{active?.name}</p>
          )}
        </div>
        <Link href="/chat" aria-label={t("menu.chat")} className="relative flex size-11 items-center justify-center rounded-lg hover:bg-white/10">
          <MessageCircle aria-hidden />
          <Badge count={unreadChat.data} />
        </Link>
        <Link href="/nachrichten" aria-label={t("menu.notifications")} className="relative flex size-11 items-center justify-center rounded-lg hover:bg-white/10">
          <Bell aria-hidden />
          <Badge count={unreadNotes.data} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
