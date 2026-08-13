"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, Sparkles } from "lucide-react";
import { instrumentSerif } from "@/lib/fonts";
import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { useJobs } from "@/components/jobs/job-store";
import { useT } from "@/components/i18n/language-provider";
import type { HiringBoard, HiringCompany } from "@/lib/hiring-board";

type Facet = "all" | "open" | "A" | "B";

function Logo({ company, domain }: { company: string; domain?: string }) {
  if (domain) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/logo?domain=${encodeURIComponent(domain)}`}
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-lg border border-border bg-surface object-contain p-1"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const fallback = e.currentTarget.nextElementSibling;
          if (fallback instanceof HTMLElement) fallback.style.display = "grid";
        }}
      />
    );
  }
  return <CompanyLogo name={company} size={36} />;
}

export function HiringBoardView({ board }: { board: HiringBoard }) {
  const { t } = useT();
  const { startJob } = useJobs();
  const router = useRouter();
  const [facet, setFacet] = useState<Facet>("all");
  const [openName, setOpenName] = useState<string | null>(
    board.companies.find((c) => c.jobs.length > 0)?.name ?? null,
  );

  const visible = useMemo(() => {
    return board.companies.filter((c) => {
      if (facet === "open") return c.jobs.length > 0;
      if (facet === "A" || facet === "B") return c.cohort === facet;
      return true;
    });
  }, [board.companies, facet]);

  const withJobs = board.companies.filter((c) => c.jobs.length > 0).length;

  function evaluate(company: string, role: string, url: string) {
    startJob({
      title: `Evaluate · ${company}`,
      subtitle: role,
      kind: "evaluate",
      input: url,
      page: "/evaluate",
    });
    router.push("/evaluate");
  }

  const facets: { id: Facet; label: string }[] = [
    { id: "all", label: t("hiring.facetAll") },
    { id: "open", label: t("hiring.facetOpen") },
    { id: "A", label: t("hiring.facetA") },
    { id: "B", label: t("hiring.facetB") },
  ];

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="size-6 text-brand" />
          <h1 className="font-display text-2xl tracking-tight text-landing">{t("hiring.title")}</h1>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">{t("hiring.lead")}</p>
        <p className="mt-3 text-sm text-muted">
          {t("hiring.summary", { companies: board.companies.length, jobs: board.openJobs, withJobs })}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {facets.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFacet(f.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition max-sm:min-h-[44px]",
              facet === f.id
                ? "border-brand/40 bg-brand-soft text-brand-text"
                : "border-border text-muted hover:border-brand/30 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface/30 p-6 text-sm text-muted">
          {t("hiring.empty")}
        </p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((c) => (
            <CompanyCard
              key={c.name}
              company={c}
              expanded={openName === c.name}
              onToggle={() => setOpenName(openName === c.name ? null : c.name)}
              onEvaluate={evaluate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CompanyCard({
  company,
  expanded,
  onToggle,
  onEvaluate,
}: {
  company: HiringCompany;
  expanded: boolean;
  onToggle: () => void;
  onEvaluate: (company: string, role: string, url: string) => void;
}) {
  const { t } = useT();
  const open = company.jobs.filter((j) => !j.done).length;

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-surface/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left max-sm:min-h-[44px]"
      >
        <span className="relative inline-flex size-9 shrink-0">
          <Logo company={company.name} domain={company.domain} />
          <span className="absolute inset-0 hidden place-items-center rounded-lg bg-brand-soft text-sm font-semibold text-brand">
            {company.name.slice(0, 1)}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${instrumentSerif.className} text-lg leading-tight text-foreground`}>{company.name}</span>
            <Badge tone={company.cohort === "A" ? "info" : "muted"}>
              {company.cohort === "A" ? t("hiring.cohortA") : t("hiring.cohortB")}
            </Badge>
            {company.stage && <span className="text-xs text-faint">{company.stage}</span>}
            {company.founded && <span className="text-xs text-faint">{t("hiring.founded", { year: company.founded })}</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {open > 0 ? t("hiring.jobCount", { n: open }) : t("hiring.noStructuredJobs")}
          </p>
        </div>
        {company.careersUrl && (
          <a
            href={company.careersUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-brand max-sm:min-h-[44px]"
          >
            {t("hiring.careers")} <ExternalLink className="size-3.5" />
          </a>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {company.jobs.length === 0 ? (
            <p className="text-sm text-muted">
              {t("hiring.emptyCompany")}
              {company.careersUrl && (
                <>
                  {" "}
                  <a href={company.careersUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    {t("hiring.openSite")}
                  </a>
                </>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {company.jobs.map((job) => (
                <li key={job.url} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-brand">
                      {job.role}
                    </a>
                    {job.location && <p className="text-xs text-faint">{job.location}</p>}
                  </div>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground max-sm:min-h-[44px]"
                  >
                    {t("hiring.openJob")}
                  </a>
                  <button
                    type="button"
                    onClick={() => onEvaluate(company.name, job.role, job.url)}
                    className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground hover:bg-brand-200 max-sm:min-h-[44px]"
                  >
                    <Sparkles className="size-3" />
                    {t("card.evaluate")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-faint">{t("hiring.neverSubmit")}</p>
        </div>
      )}
    </li>
  );
}
