import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t } = useLanguage();
  const [loginName, setLoginName] = useState("");
  const [pin, setPin] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      setPin("");
      onLoggedIn();
    },
    onError: () => setPin(""),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ loginName, pin });
  };

  const errorText = login.error
    ? login.error.data?.code === "TOO_MANY_REQUESTS"
      ? t("login.blocked")
      : t("login.failed")
    : null;

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-center text-2xl font-bold">{t("app.name")}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{t("login.title")}</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("login.loginName")}</span>
          <input
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-lg"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("login.pin")}</span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            minLength={4}
            required
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-lg tracking-widest"
          />
        </label>
        {errorText && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-stop">
            {errorText}
          </p>
        )}
        <button
          type="submit"
          disabled={login.isPending}
          className="min-h-12 rounded-lg bg-brand text-lg font-semibold text-white disabled:opacity-60"
        >
          {login.isPending ? t("app.loading") : t("login.submit")}
        </button>
      </form>
    </main>
  );
}
