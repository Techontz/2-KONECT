/**
 * The four languages 2KONECT ships in.
 *
 * English leads and is the default. 2KONECT sells into Tanzania and sources
 * from China, the UAE, Türkiye and beyond, so the interface has to be legible
 * to a buyer in Dar and a supplier in Shenzhen at the same time. Kiswahili
 * stays one tap away for the market the storefront serves first.
 */
export const LANGUAGES = [
  { code: "en", label: "English", english: "English", flag: "🇬🇧", locale: "en-GB" },
  { code: "sw", label: "Kiswahili", english: "Swahili", flag: "🇹🇿", locale: "sw-TZ" },
  { code: "fr", label: "Français", english: "French", flag: "🇫🇷", locale: "fr-FR" },
  { code: "zh", label: "中文", english: "Chinese", flag: "🇨🇳", locale: "zh-CN" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguage(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

export function languageMeta(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}
