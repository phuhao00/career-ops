"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, STORAGE_KEY, localeInfo, normalizeLocale } from "@/lib/i18n/locale.mjs";
import { translate, type MsgKey, type MsgVars } from "@/lib/i18n/messages";

type Ctx = {
  locale: string;
  setLocale: (id: string) => void;
  t: (key: MsgKey, fallbackOrVars?: string | MsgVars, vars?: MsgVars) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

function applyDocumentLocale(id: string) {
  const info = localeInfo(id);
  document.documentElement.lang = info.id === "zh" ? "zh-CN" : info.id;
  document.documentElement.dir = info.dir;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    let cancelled = false;
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (stored) {
      const n = normalizeLocale(stored);
      setLocaleState(n);
      applyDocumentLocale(n);
    }
    fetch("/api/locale")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const fromProfile = typeof d.output === "string" ? normalizeLocale(d.output) : null;
        if (!stored && fromProfile) {
          setLocaleState(fromProfile);
          applyDocumentLocale(fromProfile);
        } else if (!stored && !fromProfile && typeof navigator !== "undefined") {
          const n = normalizeLocale(navigator.language);
          setLocaleState(n);
          applyDocumentLocale(n);
        }
      })
      .catch(() => {
        if (cancelled || stored) return;
        const n = normalizeLocale(typeof navigator !== "undefined" ? navigator.language : DEFAULT_LOCALE);
        setLocaleState(n);
        applyDocumentLocale(n);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((id: string) => {
    const n = normalizeLocale(id);
    setLocaleState(n);
    applyDocumentLocale(n);
    try {
      localStorage.setItem(STORAGE_KEY, n);
    } catch {
      /* ignore */
    }
    fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output: n }),
    }).catch(() => {});
  }, []);

  const t = useCallback(
    (key: MsgKey, fallbackOrVars?: string | MsgVars, vars?: MsgVars) => {
      if (fallbackOrVars && typeof fallbackOrVars === "object") {
        return translate(locale, key, undefined, fallbackOrVars);
      }
      return translate(locale, key, fallbackOrVars, vars);
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used within <LanguageProvider>");
  return ctx;
}
