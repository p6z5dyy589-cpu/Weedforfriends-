import { useLanguage } from "@/contexts/LanguageContext";
import { errorKey } from "@/lib/errors";

export function useErrorText() {
  const { tx } = useLanguage();
  return (err: unknown): string => tx(errorKey(err), "app.error");
}
