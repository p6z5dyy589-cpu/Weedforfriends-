import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import KioskQuickMenu from "./KioskQuickMenu";
import type { Role } from "@shared/roles";

export interface Me {
  displayName: string;
  role: Role;
  activeCompanyId: number;
  companies: { id: number; name: string }[];
}

export default function MobileShell({ me, children }: { me: Me; children: ReactNode }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const switchCompany = trpc.auth.switchCompany.useMutation({
    // Drop every cached query so no data of the previous company survives.
    onSuccess: () => queryClient.resetQueries(),
  });
  const active = me.companies.find((c) => c.id === me.activeCompanyId);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-brand px-4 py-2 text-white pt-[max(0.5rem,env(safe-area-inset-top))]">
        <KioskQuickMenu role={me.role} />
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
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">{children}</main>
    </div>
  );
}
