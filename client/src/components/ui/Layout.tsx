import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export function PageHeader({ title, back, children, coordination }: { title: string; back?: string; children?: ReactNode; coordination?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="mb-4 flex flex-col gap-2">
      {back && (
        <Link href={back} className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-slate-600 hover:bg-slate-200">
          <ChevronLeft className="size-5" aria-hidden />
          {t("app.back")}
        </Link>
      )}
      {coordination && <span className="w-fit rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-800">{t("menu.coordination")}</span>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Section({ title, children, tone }: { title: string; children: ReactNode; tone?: "stop" }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={`font-semibold ${tone === "stop" ? "text-stop" : "text-slate-700"}`}>{title}</h2>
      {children}
    </section>
  );
}

/** Simple segmented tabs with large targets. */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-200 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className="min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-slate-700 aria-selected:bg-white aria-selected:text-slate-900 aria-selected:shadow-sm"
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className="ml-1 rounded-full bg-slate-700 px-1.5 text-xs text-white">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
