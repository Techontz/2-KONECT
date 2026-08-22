"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { en, type Dictionary } from "./dictionaries/en";
import { sw } from "./dictionaries/sw";
import { fr } from "./dictionaries/fr";
import { zh } from "./dictionaries/zh";
import { DEFAULT_LANGUAGE, isLanguage, languageMeta, type LanguageCode } from "./types";
import { PAGE_CONTENT, type PageCopy, type PageKey } from "./pages";

export * from "./types";
export type { PageCopy, PageKey, PageSection, PageTopic } from "./pages";

const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, sw, fr, zh };

export const LANGUAGE_KEY = "2konect.language";

/** Dot-path into the dictionary, e.g. `"cart.empty"`. */
type Section = keyof Dictionary;
export type Path = {
  [S in Section]: `${S & string}.${keyof Dictionary[S] & string}`;
}[Section];

type Vars = Record<string, string | number>;

/**
 * The translate function's type, for the handful of helpers that are plain
 * functions rather than components and so have to be handed `t` rather than
 * calling `useT()` themselves.
 */
export type Translate = (path: Path, vars?: Vars) => string;

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

/**
 * The chosen language, held outside React.
 *
 * It has to live outside the component tree because of *when* it is read.
 * Pages that depend on the query string render inside a <Suspense> boundary,
 * and React hydrates those boundaries independently — sometimes after an
 * effect elsewhere has already applied the stored preference. A provider that
 * moved from English to Kiswahili in an effect therefore hydrated a heading
 * the server had written in English against a client that had already changed
 * its mind, which React reports as a hydration mismatch and repairs by
 * throwing the subtree away and re-rendering it.
 *
 * `useSyncExternalStore` is the fix rather than a workaround: it is the one
 * API that guarantees *every* subtree hydrates against the server snapshot,
 * whenever that subtree happens to hydrate, and only then re-reads the client
 * value. The server always says English; the browser switches to the stored
 * language the moment hydration is done.
 */
const store = {
  language: DEFAULT_LANGUAGE as LanguageCode,
  /** False until this visitor has ever chosen a language. */
  chosen: false,
  read: false,
  listeners: new Set<() => void>(),
};

function readStored() {
  if (store.read || typeof window === "undefined") return;
  store.read = true;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (isLanguage(stored)) {
      store.language = stored;
      store.chosen = true;
    }
  } catch {
    // Private browsing can refuse storage; the site still works, it just
    // asks for a language again next time.
  }
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => { store.listeners.delete(listener); };
}

function getSnapshot(): LanguageCode {
  readStored();
  return store.language;
}

/** The server has no preference to read, so it always writes the default. */
function getServerSnapshot(): LanguageCode {
  return DEFAULT_LANGUAGE;
}

/** One translator per language, so `t` keeps a stable identity across renders. */
const translators = new Map<LanguageCode, LanguageState["t"]>();

function translatorFor(language: LanguageCode): LanguageState["t"] {
  const cached = translators.get(language);
  if (cached) return cached;

  const dictionary = DICTIONARIES[language] ?? DICTIONARIES[DEFAULT_LANGUAGE];
  const translate: LanguageState["t"] = (path, vars) => {
    // Fall back through the reference dictionary so a key that is missing in
    // one language degrades to English rather than to a raw dot-path.
    const template = lookup(dictionary, path) ?? lookup(en, path) ?? path;
    return interpolate(template, vars);
  };

  translators.set(language, translate);
  return translate;
}

interface Controls {
  ready: boolean;
  setLanguage: (code: LanguageCode) => void;
}

const LanguageContext = createContext<Controls | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    store.language = code;
    store.chosen = true;
    try {
      window.localStorage.setItem(LANGUAGE_KEY, code);
    } catch {
      /* preference simply is not remembered */
    }
    store.listeners.forEach((listener) => listener());
  }, []);

  const controls = useMemo<Controls>(() => ({ ready, setLanguage }), [ready, setLanguage]);

  return (
    <LanguageContext.Provider value={controls}>
      <DocumentLanguage />
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Keeps <html lang> in step for screen readers and browser translation, and
 * releases the pre-hydration guard.
 *
 * The guard (lib/i18n/boot.ts) hides the body while the document still says
 * English but the shopper has asked for something else. This is the other half
 * of it: the moment React has rendered in the stored language, the mark comes
 * off and the page appears — already correct, never having shown the wrong
 * words. A layout effect rather than an effect so it happens before the
 * browser paints.
 */
function DocumentLanguage() {
  const { language } = useLanguage();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = language;

    // Release only once what is on screen is the language that was asked for.
    // React hydrates in English by necessity and switches a frame later, so
    // clearing on the first commit would reveal the very frame this hides.
    const pending = root.getAttribute("data-lang-pending");
    if (pending === null || pending === language) {
      root.removeAttribute("data-lang-pending");
    }
  }, [language]);

  return null;
}

/**
 * The active language.
 *
 * Each consumer subscribes to the store itself rather than reading the
 * language off the context, and that is the whole point rather than an
 * inefficiency. A context value propagates the instant the provider re-renders
 * — but a page whose content sits inside a <Suspense> boundary hydrates on its
 * own schedule, and on a dynamically rendered route it was hydrating *after*
 * the provider had already switched to the stored language. React then found
 * "Home" in the server's HTML where the client wanted "Mwanzo" and threw the
 * subtree away to rebuild it.
 *
 * `useSyncExternalStore` is the only way to be right here: it hands whichever
 * component is hydrating the *server* snapshot for the duration of its own
 * hydration, no matter how late that happens, and switches it to the stored
 * language immediately afterwards. The server is always English; the browser
 * catches up the moment each boundary is safely attached.
 */
export function useLanguage(): LanguageState {
  const controls = useContext(LanguageContext);
  if (!controls) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }

  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => ({
    language,
    ready: controls.ready,
    needsChoice: controls.ready && !store.chosen,
    setLanguage: controls.setLanguage,
    locale: languageMeta(language).locale,
    t: translatorFor(language),
  }), [language, controls]);
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
