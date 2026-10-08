import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { SelectInput } from "./ui/Fields";

/** People of the active company only (server-side filtered). */
export function PersonSelect({ label, value, onChange, allowEmpty = true }: { label: string; value: number | null; onChange: (id: number | null) => void; allowEmpty?: boolean }) {
  const { t } = useLanguage();
  const people = trpc.people.directory.useQuery();
  return (
    <SelectInput label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} disabled={people.isLoading}>
      {allowEmpty && <option value="">{t("app.unassigned")}</option>}
      {people.data?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.displayName}
        </option>
      ))}
    </SelectInput>
  );
}
