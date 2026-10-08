import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { NAV_GROUPS, navItemsFor } from "@shared/navigation";
import type { Role } from "@shared/roles";
import { trpc } from "@/lib/trpc";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n/de";

export default function KioskQuickMenu({ role }: { role: Role }) {
  const { t, language, setLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => queryClient.resetQueries() });
  const items = navItemsFor(role);

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
              return (
                <section key={group}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t(`nav.group.${group}` as TranslationKey)}
                  </h3>
                  {groupItems.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">{t("menu.notSetUp")}</p>
                  ) : (
                    groupItems.map((item) => (
                      <Dialog.Close asChild key={item.path}>
                        <Link href={item.path} className="flex min-h-11 items-center rounded-lg px-3 font-medium hover:bg-slate-100">
                          {t(item.labelKey as TranslationKey)}
                        </Link>
                      </Dialog.Close>
                    ))
                  )}
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
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="min-h-11 rounded-lg border border-slate-300 font-medium"
            >
              {t("login.logout")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
