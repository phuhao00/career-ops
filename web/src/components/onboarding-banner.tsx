"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Settings } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import type { MsgKey } from "@/lib/i18n/messages";

type Doctor = { available: boolean; onboardingNeeded: boolean; missing: string[]; warnings: string[] };

function hasCli(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem("career-ops:config") || "{}").cliId;
  } catch {
    return false;
  }
}

export function OnboardingBanner() {
  const { t } = useT();
  const [d, setD] = useState<Doctor | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [cli, setCli] = useState(true); // assume until read (avoid CTA flash)

  useEffect(() => {
    setCli(hasCli());
    fetch("/api/doctor")
      .then((r) => r.json())
      .then(setD)
      .catch(() => {});
  }, []);

  if (dismissed || !d || !d.onboardingNeeded) return null;
  const fileKey = (m: string): MsgKey =>
    m === "cv.md" ? "onboard.file.cv"
    : m === "config/profile.yml" ? "onboard.file.profile"
    : m === "modes/_profile.md" ? "onboard.file.modes"
    : m === "portals.yml" ? "onboard.file.portals"
    : "onboard.file.cv";
  const items = d.missing.map((m) => t(fileKey(m)));
  const kickoff =
    `Help me finish setting up career-ops. I still need to add ${items.join(", ")} — walk me through just those, conversationally, and write the files for me. Don't ask me for anything that's already set up (for example, don't ask for my CV if it's already saved).`;

  return (
    <div className="dot-bg relative mb-6 overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 via-surface/40 to-transparent p-5">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-faint transition-colors hover:text-foreground"
        aria-label={t("onboard.dismiss")}
      >
        <X className="size-4" />
      </button>
      <h2 className="font-display text-xl text-landing">{t("onboard.title")}</h2>
      <p className="mt-1.5 max-w-xl text-sm text-muted">
        {t("onboard.bodyBefore", { items: items.join(", ") })}{" "}
        <span className="text-foreground">{t("onboard.noYaml")}</span> {t("onboard.bodyAfter")}
      </p>
      {cli ? (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("co-assistant", { detail: { message: kickoff } }))}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
        >
          <Sparkles className="size-4" /> {t("onboard.cta")}
        </button>
      ) : (
        // The assistant needs a CLI to run — without one the kickoff would silently
        // drop. Send them to connect one first.
        <Link
          href="/config"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
        >
          <Settings className="size-4" /> {t("onboard.connect")}
        </Link>
      )}
    </div>
  );
}
