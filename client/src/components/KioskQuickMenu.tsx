import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { NAV_GROUPS, navItemsFor } from "@shared/navigation";
import { trpc } from "@/lib/trpc";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { useMe } from "@/hooks/useMe";
import type { TranslationKey } from "@/i18n";

export default function KioskQuickMenu() {
  const { t, language, setLanguage } = useLanguage();
  const me = useMe();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => queryClient.resetQueries() });
  const items = navItemsFor(me.roles);

  return (
    <Dialog.Root>
      <Dialog.Trigger className="flex size-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label={t("menu.open")}>
        <Menu aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-20 bg-black/40" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-30 flex w-80 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{t("menu.title")}</Dialog.Title>
            <Dialog.Close className="flex size-11 items-center justify-center rounded-lg hover:bg-slate-100" aria-label={t("menu.close")}>
              <X aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("menu.title")}</Dialog.Description>
          <nav className="flex flex-col gap-4">
            {NAV_GROUPS.map((group) => {
              const groupItems = items.filter((i) => i.group === group);
              // Groups without anything for this person are not shown at all.
              if (groupItems.length === 0) return null;
              return (
                <section key={group}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`nav.group.${group}` as TranslationKey)}</h3>
                  {groupItems.map((item) => (
                    <Dialog.Close asChild key={item.path}>
                      <Link
                        href={item.path}
                        aria-current={location === item.path ? "page" : undefined}
                        className="flex min-h-11 items-center justify-between rounded-lg px-3 font-medium hover:bg-slate-100 aria-[current=page]:bg-slate-100"
                      >
                        {t(item.labelKey as TranslationKey)}
                        {item.coordination && <span className="text-xs font-normal text-indigo-700">{t("menu.coordination")}</span>}
                      </Link>
                    </Dialog.Close>
                  ))}
                </section>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t pt-4">
            <div role="group" aria-label={t("menu.language")} className="flex gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  aria-pressed={language === lang}
                  onClick={() => setLanguage(lang)}
                  className="min-h-11 flex-1 rounded-lg border font-medium aria-pressed:bg-brand aria-pressed:text-white"
                >
                  {lang === "cs" ? "CZ" : "DE"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => logout.mutate()} className="min-h-11 rounded-lg border border-slate-300 font-medium">
              {t("login.logout")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
