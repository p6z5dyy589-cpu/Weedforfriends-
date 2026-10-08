import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { de, type TranslationKey } from "@/i18n/de";
import { cs } from "@/i18n/cs";

export const LANGUAGES = ["de", "cs"] as const;
export type Language = (typeof LANGUAGES)[number];

const dictionaries: Record<Language, Record<TranslationKey, string>> = { de, cs };
const STORAGE_KEY = "fe.language";

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "cs") return stored;
  } catch {
    // storage unavailable - fall back to German
  }
  return "de";
}

interface LanguageValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const value = useMemo<LanguageValue>(
    () => ({
      language,
      setLanguage: (lang) => {
        setLanguageState(lang);
        try {
          localStorage.setItem(STORAGE_KEY, lang);
        } catch {
          // ignore
        }
        document.documentElement.lang = lang;
      },
      t: (key) => dictionaries[language][key],
    }),
    [language],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage outside LanguageProvider");
  return value;
}
