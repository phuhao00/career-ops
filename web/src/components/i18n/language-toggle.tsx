"use client";

import { LOCALES } from "@/lib/i18n/locale.mjs";
import { useT } from "@/components/i18n/language-provider";
import { cn } from "@/lib/cn";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useT();
  return (
    <label className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="sr-only">{t("lang.aria")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        aria-label={t("lang.aria")}
        title={t("lang.label")}
        className="w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-brand/50 max-sm:min-h-[44px]"
      >
        {LOCALES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
