import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { cs, de, type TranslationKey } from "@/i18n";

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

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface LanguageValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translate;
  /** Translates a dynamic key, falling back when it does not exist. */
  tx: (key: string, fallback: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function interpolate(text: string, vars?: Record<string, string | number>): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const lang = initialLanguage();
    document.documentElement.lang = lang;
    return lang;
  });
  const value = useMemo<LanguageValue>(() => {
    const dict = dictionaries[language];
    return {
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
      t: (key, vars) => interpolate(dict[key], vars),
      tx: (key, fallback) => (key in dict ? dict[key as TranslationKey] : dict[fallback]),
    };
  }, [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage outside LanguageProvider");
  return value;
}
