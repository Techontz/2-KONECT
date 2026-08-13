/**
 * The four languages Direct2Kariakoo ships in.
 *
 * Kiswahili leads because it is the language of the market this storefront
 * actually serves — the ordering here is the ordering shown to visitors.
 */
export const LANGUAGES = [
  { code: "sw", label: "Kiswahili", english: "Swahili", flag: "🇹🇿", locale: "sw-TZ" },
  { code: "en", label: "English", english: "English", flag: "🇬🇧", locale: "en-GB" },
  { code: "fr", label: "Français", english: "French", flag: "🇫🇷", locale: "fr-FR" },
  { code: "zh", label: "中文", english: "Chinese", flag: "🇨🇳", locale: "zh-CN" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "sw";

export function isLanguage(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

export function languageMeta(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}
