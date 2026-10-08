import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

const inputCls = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fid} className="text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-500">({hint})</span>}
      </label>
      {children(fid)}
    </div>
  );
}

export function TextInput({ label, hint, ...rest }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} hint={hint}>{(id) => <input id={id} className={inputCls} {...rest} />}</Field>;
}

export function NumberInput({
  label,
  hint,
  value,
  onChange,
  ...rest
}: { label: string; hint?: string; value: number | null; onChange: (v: number | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          className={inputCls}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          {...rest}
        />
      )}
    </Field>
  );
}

export function SelectInput({ label, hint, children, ...rest }: { label: string; hint?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} className={inputCls} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function TextArea({ label, hint, ...rest }: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label} hint={hint}>{(id) => <textarea id={id} rows={3} className={`${inputCls} py-2`} {...rest} />}</Field>;
}

/** Large checkbox row (whole row is the tap target). */
export function CheckRow({ label, checked, onChange, disabled, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; description?: ReactNode }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 ${disabled ? "opacity-60" : ""}`}>
      <input type="checkbox" className="size-6 shrink-0 accent-brand" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm text-slate-600">{description}</span>}
      </span>
    </label>
  );
}

/** Yes / No / open choice as two large buttons. */
export function YesNo({ label, value, onChange, yes, no, disabled }: { label: string; value: boolean | null; onChange: (v: boolean) => void; yes: string; no: string; disabled?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-slate-700">{label}</legend>
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={disabled}
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white font-semibold aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white disabled:opacity-50"
          >
            {v ? yes : no}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
