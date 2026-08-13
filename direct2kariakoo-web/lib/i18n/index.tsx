"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en, type Dictionary } from "./dictionaries/en";
import { sw } from "./dictionaries/sw";
import { fr } from "./dictionaries/fr";
import { zh } from "./dictionaries/zh";
import { DEFAULT_LANGUAGE, isLanguage, languageMeta, type LanguageCode } from "./types";
import { PAGE_CONTENT, type PageCopy, type PageKey } from "./pages";

export * from "./types";
export type { PageCopy, PageKey, PageSection, PageTopic } from "./pages";

const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, sw, fr, zh };

export const LANGUAGE_KEY = "d2k.language";

/** Dot-path into the dictionary, e.g. `"cart.empty"`. */
type Section = keyof Dictionary;
type Path = {
  [S in Section]: `${S & string}.${keyof Dictionary[S] & string}`;
}[Section];

type Vars = Record<string, string | number>;

interface LanguageState {
  language: LanguageCode;
  /** False until the stored preference has been read on the client. */
  ready: boolean;
  /** True when this visitor has never chosen a language. */
  needsChoice: boolean;
  setLanguage: (code: LanguageCode) => void;
  t: (path: Path, vars?: Vars) => string;
  /** BCP-47 tag for Intl formatting. */
  locale: string;
}

const LanguageContext = createContext<LanguageState | null>(null);

function lookup(dictionary: Dictionary, path: string): string | undefined {
  const [section, key] = path.split(".");
  const bucket = (dictionary as Record<string, Record<string, string>>)[section];
  return bucket?.[key];
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    // An unknown placeholder is left visible rather than blanked: a missing
    // value is easier to spot in review than a sentence with a hole in it.
    name in vars ? String(vars[name]) : whole,
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // The first render must match the server output, so it always uses the
  // default language; the stored preference is applied immediately after
  // mount. Anything else produces a hydration mismatch.
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LANGUAGE_KEY);
    } catch {
      // Private browsing can refuse storage; the site still works, it just
      // asks for a language again next time.
    }

    if (isLanguage(stored)) {
      setLanguageState(stored);
    } else {
      setNeedsChoice(true);
    }
    setReady(true);
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    setNeedsChoice(false);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, code);
    } catch {
      /* preference simply is not remembered */
    }
  }, []);

  // Keep the document in step so screen readers announce the right language
  // and the browser offers the right translation behaviour.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageState>(() => {
    const dictionary = DICTIONARIES[language] ?? DICTIONARIES[DEFAULT_LANGUAGE];

    return {
      language,
      ready,
      needsChoice,
      setLanguage,
      locale: languageMeta(language).locale,
      t: (path, vars) => {
        // Fall back through the reference dictionary so a key that is missing
        // in one language degrades to English rather than to a raw dot-path.
        const template = lookup(dictionary, path) ?? lookup(en, path) ?? path;
        return interpolate(template, vars);
      },
    };
  }, [language, ready, needsChoice, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return context;
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useLanguage().t;
}

/**
 * Long-form page copy (legal, help, company) in the active language.
 *
 * Separate from `t()` because these are whole documents rather than labels,
 * and a page must render as one coherent piece rather than as fragments.
 */
export function usePageContent(key: PageKey): PageCopy {
  const { language } = useLanguage();
  return (PAGE_CONTENT[language] ?? PAGE_CONTENT[DEFAULT_LANGUAGE])[key];
}
