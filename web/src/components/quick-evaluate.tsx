"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";
import { classifyInput } from "@/lib/eval-pipeline.mjs";
import { useT } from "@/components/i18n/language-provider";
import type { MsgKey } from "@/lib/i18n/messages";

// Compact launcher on Today: paste a job URL (or a short JD) → fire the real
// evaluate worker and jump to /evaluate so the six-step pipeline is visible.
export function QuickEvaluate() {
  const router = useRouter();
  const { startJob } = useJobs();
  const { t } = useT();
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState("");

  function run() {
    const parsed = classifyInput(url);
    if (!parsed.ok) {
      setHint(t(`eval.err.${parsed.code}` as MsgKey));
      return;
    }
    startJob({
      title: parsed.mode === "url" ? t("eval.jobTitleUrl") : t("eval.jobTitleJd"),
      subtitle: parsed.mode === "url" ? parsed.value.split(/\s+/, 1)[0] : t("eval.subtitleJd"),
      kind: "evaluate",
      input: parsed.value,
      page: "/evaluate",
    });
    setUrl("");
    router.push("/evaluate");
  }

  return (
    <div className="mt-7">
      <div className="flex max-w-xl items-center gap-2 rounded-full border border-border bg-surface/70 py-1.5 pl-4 pr-1.5 shadow-sm focus-within:border-brand/50">
        <Sparkles className="size-4 shrink-0 text-brand/70" />
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (hint) setHint("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder={t("quick.placeholder")}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-faint"
        />
        <button
          onClick={run}
          className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 max-sm:min-h-[44px]"
        >
          {t("quick.evaluate")}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CostBadge kind="spend" size="xs" />
        <span className="text-xs text-faint">
          {t("quick.hint")}{" "}
          <Link href="/evaluate" className="text-brand hover:underline">
            {t("nav.evaluate")}
          </Link>
          .
        </span>
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}
