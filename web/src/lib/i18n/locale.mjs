/**
 * Locale ids for the web UI — aligned with config/profile.yml `language.output`
 * (ISO codes). `zh` is Simplified Chinese; `zh-TW` is Traditional.
 */

export const DEFAULT_LOCALE = "en";
export const STORAGE_KEY = "career-ops:lang";

/** @typedef {{ id: string, label: string, dir: "ltr" | "rtl" }} LocaleInfo */

/** @type {ReadonlyArray<LocaleInfo>} */
export const LOCALES = [
  { id: "en", label: "English", dir: "ltr" },
  { id: "zh", label: "简体中文", dir: "ltr" },
  { id: "zh-TW", label: "繁體中文", dir: "ltr" },
  { id: "ja", label: "日本語", dir: "ltr" },
  { id: "ko", label: "한국어", dir: "ltr" },
  { id: "de", label: "Deutsch", dir: "ltr" },
  { id: "fr", label: "Français", dir: "ltr" },
  { id: "es", label: "Español", dir: "ltr" },
  { id: "ar", label: "العربية", dir: "rtl" },
];

const ALIASES = {
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-sg": "zh",
  "zh-tw": "zh-TW",
  "zh-hant": "zh-TW",
  "zh-hk": "zh-TW",
  "zh-mo": "zh-TW",
};

const IDS = LOCALES.map((l) => l.id);

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeLocale(raw) {
  if (typeof raw !== "string" || !raw.trim()) return DEFAULT_LOCALE;
  const lower = raw.trim().toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  const exact = IDS.find((id) => id.toLowerCase() === lower);
  if (exact) return exact;
  const prefix = lower.split("-")[0];
  return IDS.find((id) => id.toLowerCase() === prefix) || DEFAULT_LOCALE;
}

/**
 * @param {string} id
 * @returns {LocaleInfo}
 */
export function localeInfo(id) {
  const n = normalizeLocale(id);
  return LOCALES.find((l) => l.id === n) || LOCALES[0];
}

/**
 * Name the agent should write reports in (AGENTS.md language.output).
 * @param {string} id
 * @returns {string}
 */
export function promptLanguageName(id) {
  const names = {
    en: "English",
    zh: "Simplified Chinese (zh-CN)",
    "zh-TW": "Traditional Chinese (zh-TW)",
    ja: "Japanese",
    ko: "Korean",
    de: "German",
    fr: "French",
    es: "Spanish",
    ar: "Arabic",
  };
  return names[normalizeLocale(id)] || "English";
}

/**
 * BCP 47 tag for Date#toLocaleDateString.
 * @param {string} id
 * @returns {string}
 */
export function dateLocale(id) {
  const n = normalizeLocale(id);
  if (n === "zh") return "zh-CN";
  return n;
}

/**
 * Injected into every web worker prompt so reports follow language.output.
 * @param {string} id
 * @returns {string}
 */
export function languageDirective(id) {
  const name = promptLanguageName(id);
  return `Write all human-facing output in ${name}. This includes the report body, tracker notes, cover-letter-style prose, and any summary. Keep the English marker VERDICT (do not translate that word) so the pipeline can parse the score line; write the reason after the dash in ${name}. Keep market-specific terms when they are relevant, but explain them in ${name} when needed.`;
}
