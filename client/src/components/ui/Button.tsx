import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "stop";

const styles: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-slate-800",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  danger: "bg-stop text-white hover:bg-red-800",
  stop: "border-2 border-stop bg-white text-stop hover:bg-red-50",
  ghost: "text-slate-700 hover:bg-slate-100",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

/** Large touch target (min 48px), one clear label. */
export function Button({ variant = "primary", block, loading, icon, className = "", children, disabled, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
