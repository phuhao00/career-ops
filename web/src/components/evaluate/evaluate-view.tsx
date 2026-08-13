"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  FileDown,
  FileText,
  Loader2,
  RotateCcw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { instrumentSerif } from "@/lib/fonts";
import { HeroGlow } from "@/components/hero-glow";
import { CostBadge } from "@/components/cost/cost-badge";
import { Badge } from "@/components/ui/badge";
import { DecisionCard } from "@/components/home/decision-card";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";
import { parseReport, legitimacyTone, scoreTone } from "@/lib/format";
import type { Application } from "@/lib/career-ops";
import { classifyInput, derivePipeline, extractReportNum } from "@/lib/eval-pipeline.mjs";
import { useT } from "@/components/i18n/language-provider";
import type { MsgKey } from "@/lib/i18n/messages";

type StageStatus = "pending" | "active" | "done" | "error" | "ready";

const STYLE = `
@keyframes co-eval-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.co-eval-rise{animation:co-eval-rise .45s cubic-bezier(.22,1,.36,1) both}
@media(prefers-reduced-motion:reduce){.co-eval-rise{animation:none}}
`;

function useElapsed(running: boolean, startedAt: number): number {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running, startedAt]);
  return Math.max(0, now - startedAt);
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function hasCli(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem("career-ops:config") || "{}").cliId;
  } catch {
    return false;
  }
}

function matchApplication(job: Job | undefined, applications: Application[]): Application | undefined {
  if (!job) return undefined;
  const n = extractReportNum(`${job.text || ""} ${job.result?.summary || ""}`);
  if (n) {
    const hit = applications.find((a) => a.n.replace(/^0+/, "") === n.replace(/^0+/, "") || a.n === n);
    if (hit) return hit;
  }
  return undefined;
}

export function EvaluateView({ applications }: { applications: Application[] }) {
  const { t } = useT();
  const router = useRouter();
  const { jobs, startJob } = useJobs();
  const [mode, setMode] = useState<"url" | "jd">("url");
  const [raw, setRaw] = useState("");
  const [hint, setHint] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [cliOk, setCliOk] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    setCliOk(hasCli());
  }, []);

  useEffect(() => {
    const onDone = () => router.refresh();
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [router]);

  const job = useMemo(() => {
    if (jobId === "__new__") return undefined;
    if (jobId) return jobs.find((j) => j.id === jobId);
    return jobs.filter((j) => j.kind === "evaluate").sort((a, b) => b.startedAt - a.startedAt)[0];
  }, [jobs, jobId]);

  const reportNum = job ? extractReportNum(job.text || "") : null;
  const pdfJob = useMemo(() => {
    if (!reportNum) return undefined;
    return jobs.filter((j) => j.kind === "pdf" && j.input === reportNum).sort((a, b) => b.startedAt - a.startedAt)[0];
  }, [jobs, reportNum]);

  const { stages, activeIndex } = derivePipeline(job, pdfJob);
  const focused = stages.find((s) => s.id === focusId) ?? stages[activeIndex >= 0 ? activeIndex : 0];
  const running = job?.status === "running";
  const elapsed = useElapsed(!!running && !!job, job?.startedAt ?? Date.now());
  const app = matchApplication(job, applications);

  function run() {
    const parsed = classifyInput(raw);
    if (!parsed.ok) {
      setHint(t(`eval.err.${parsed.code}` as MsgKey));
      return;
    }
    if (!hasCli()) {
      setCliOk(false);
      setHint(t("eval.cliMissing"));
      return;
    }
    const id = startJob({
      title: parsed.mode === "url" ? t("eval.jobTitleUrl") : t("eval.jobTitleJd"),
      subtitle: parsed.mode === "url" ? parsed.value.split(/\s+/, 1)[0] : t("eval.subtitleJd"),
      kind: "evaluate",
      input: parsed.value,
      page: "/evaluate",
    });
    setJobId(id);
    setHint("");
    setRaw("");
    setFocusId("jd");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 max-sm:pb-24">
      <style>{STYLE}</style>

      <section className="dot-bg relative overflow-hidden rounded-2xl border border-border bg-surface/40 px-7 py-10 md:px-10 md:py-12">
        <HeroGlow />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-surface/55 backdrop-blur-[2px] dark:bg-background/45" />
        <div className="relative z-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            <span className="text-faint">//</span> {t("eval.kicker")}
          </p>
          <h1 className={`${instrumentSerif.className} mt-3 text-4xl leading-[1.05] text-landing md:text-5xl`}>
            {t("eval.title")}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{t("eval.lead")}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("url");
                setHint("");
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition max-sm:min-h-[44px]",
                mode === "url" ? "border-brand/50 bg-brand-soft text-brand-text" : "border-border text-muted hover:text-foreground",
              )}
            >
              {t("eval.modeUrl")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("jd");
                setHint("");
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition max-sm:min-h-[44px]",
                mode === "jd" ? "border-brand/50 bg-brand-soft text-brand-text" : "border-border text-muted hover:text-foreground",
              )}
            >
              {t("eval.modeJd")}
            </button>
          </div>

          {mode === "url" ? (
            <div className="mt-4 flex max-w-xl items-center gap-2 rounded-full border border-border bg-surface/70 py-1.5 pl-4 pr-1.5 shadow-sm focus-within:border-brand/50">
              <ClipboardCheck className="size-4 shrink-0 text-brand/70" />
              <input
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  if (hint) setHint("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") run();
                }}
                placeholder={t("eval.placeholderUrl")}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-faint"
              />
              <button
                type="button"
                onClick={run}
                disabled={running}
                className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50 max-sm:min-h-[44px]"
              >
                {running ? t("eval.ctaRunning") : t("eval.cta")}
              </button>
            </div>
          ) : (
            <div className="mt-4 max-w-xl">
              <textarea
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  if (hint) setHint("");
                }}
                rows={6}
                placeholder={t("eval.placeholderJd")}
                className="w-full resize-y rounded-2xl border border-border bg-surface/70 px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand/50"
              />
              <button
                type="button"
                onClick={run}
                disabled={running}
                className="mt-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50 max-sm:min-h-[44px]"
              >
                {running ? t("eval.ctaRunning") : t("eval.ctaJd")}
              </button>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CostBadge kind="spend" size="xs" />
            <span className="text-xs text-faint">{t("eval.costHint")}</span>
            {!cliOk && (
              <Link href="/config" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                <Settings className="size-3" /> {t("eval.openConfig")}
              </Link>
            )}
          </div>
          {hint && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{hint}</p>}
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <PipelineRail
          stages={stages}
          focusId={focused.id}
          onFocus={setFocusId}
          running={!!running}
          elapsed={elapsed}
        />
        <StageDetail
          stage={focused}
          job={job}
          app={app}
          onReset={() => {
            setJobId("__new__");
            setFocusId(null);
            setHint("");
          }}
        />
      </div>
    </div>
  );
}

function PipelineRail({
  stages,
  focusId,
  onFocus,
  running,
  elapsed,
}: {
  stages: ReturnType<typeof derivePipeline>["stages"];
  focusId: string;
  onFocus: (id: string) => void;
  running: boolean;
  elapsed: number;
}) {
  const { t } = useT();
  return (
    <ol className="relative space-y-0">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">{t("eval.pipelineTitle")}</h2>
        {running && <span className="text-xs tabular-nums text-brand">{fmtElapsed(elapsed)}</span>}
      </div>
      {stages.map((s, i) => (
        <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < stages.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute left-[11px] top-6 h-[calc(100%-8px)] w-px",
                s.status === "done" ? "bg-brand" : "bg-border",
              )}
            />
          )}
          <button
            type="button"
            onClick={() => onFocus(s.id)}
            className={cn(
              "relative z-10 flex min-w-0 flex-1 items-start gap-3 rounded-xl px-1 py-0.5 text-left transition max-sm:min-h-[44px]",
              focusId === s.id && "bg-brand-soft/50",
            )}
          >
            <StageDot status={s.status} />
            <span className="min-w-0 pt-0.5">
              <span className={cn("block text-sm font-medium", s.status === "pending" ? "text-faint" : "text-foreground")}>
                {t(`stage.${s.id}.title` as MsgKey, s.title)}
              </span>
              <span className="mt-0.5 block text-[12px] text-muted">
                {statusLabel(s.status, running && s.status === "active", t)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function statusLabel(status: StageStatus, live: boolean, t: (key: MsgKey) => string): string {
  if (status === "active" && live) return t("eval.status.active");
  if (status === "done") return t("eval.status.done");
  if (status === "error") return t("eval.status.error");
  if (status === "ready") return t("eval.status.ready");
  return t("eval.status.pending");
}

function StageDot({ status }: { status: StageStatus }) {
  return (
    <span
      className={cn(
        "relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border",
        status === "done" && "border-brand bg-brand text-brand-foreground",
        status === "active" && "border-brand text-brand",
        status === "ready" && "border-brand/50 text-brand",
        status === "error" && "border-red-400 text-red-400",
        status === "pending" && "border-border text-faint",
      )}
    >
      {status === "done" ? (
        <Check className="size-3.5" />
      ) : status === "active" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : status === "error" ? (
        <AlertTriangle className="size-3.5" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-40" />
      )}
      {status === "active" && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand/30" />}
    </span>
  );
}

function StageDetail({
  stage,
  job,
  app,
  onReset,
}: {
  stage: ReturnType<typeof derivePipeline>["stages"][number];
  job?: Job;
  app?: Application;
  onReset: () => void;
}) {
  const { t } = useT();
  const done = job?.status === "done";
  const err = job?.status === "error";
  const meta = job?.text ? parseReport(job.text) : null;
  const score = job?.result?.score ?? null;
  const tone = score != null ? scoreTone(`${score}`) : "muted";

  return (
    <div className="co-eval-rise min-w-0">
      <h3 className={`${instrumentSerif.className} text-2xl text-landing`}>
        {t(`stage.${stage.id}.title` as MsgKey, stage.title)}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {t(`stage.${stage.id}.summary` as MsgKey, stage.summary)}
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{t("eval.reads")}</dt>
          <dd className="mt-1 text-sm text-foreground">{t(`stage.${stage.id}.reads` as MsgKey, stage.reads)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{t("eval.writes")}</dt>
          <dd className="mt-1 text-sm text-foreground">{t(`stage.${stage.id}.writes` as MsgKey, stage.writes)}</dd>
        </div>
      </dl>

      {err && job && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {job.steps[job.steps.length - 1]?.label || t("eval.stopped")}{" "}
          <Link href="/config" className="underline">
            {t("eval.checkConfig")}
          </Link>
        </p>
      )}

      {done && job && score != null && (
        <div className="mt-6 rounded-2xl border border-border bg-surface/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">{t("eval.score")}</p>
              <p className={`${instrumentSerif.className} mt-1 truncate text-xl text-foreground`}>
                {meta?.title || job.subtitle || job.title}
              </p>
              {job.result?.summary && <p className="mt-1 text-sm text-muted">{job.result.summary}</p>}
            </div>
            <div className="shrink-0 text-right">
              <div
                className={cn(
                  "text-4xl font-semibold tabular-nums leading-none",
                  tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : tone === "bad" ? "text-red-400" : "text-muted",
                )}
              >
                {score}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-faint">{t("eval.fit")}</div>
            </div>
          </div>
          {meta?.legitimacy && (
            <div className="mt-3">
              <Badge tone={legitimacyTone(meta.legitimacy)}>{`${t("eval.legitimacy")}: ${meta.legitimacy}`}</Badge>
            </div>
          )}
          {score < 4 && (
            <p className="mt-3 text-sm text-muted">{t("eval.lowScore")}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {app ? (
              <>
                <Link
                  href={`/pipeline/${app.n}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground max-sm:min-h-[44px]"
                >
                  <FileText className="size-4" /> {t("eval.openReport")}
                </Link>
                <GeneratePdfButton n={app.n} company={app.company} pdfReady={app.pdf === "✅"} />
              </>
            ) : job.id ? (
              <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:border-brand/40 max-sm:min-h-[44px]">
                {t("eval.workerLog")}
              </Link>
            ) : null}
            <Link href="/pipeline?tab=EVALUATED" className="text-sm text-muted hover:text-brand">
              {t("eval.pipelineLink")}
            </Link>
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-faint">
            <ShieldCheck className="size-3.5 text-emerald-500" /> {t("eval.neverSubmit")}
          </p>
        </div>
      )}

      {done && app && (
        <div className="mt-4">
          <DecisionCard app={app} />
        </div>
      )}

      {stage.id === "pdf" && done && app && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted">
          <FileDown className="size-4 text-brand" />
          {t("eval.pdfHint")}
        </div>
      )}

      {job?.status === "running" && job.text && (
        <p className="mt-4 line-clamp-4 font-mono text-[11px] leading-relaxed text-faint">{job.text.slice(-480)}</p>
      )}

      {job && (
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-faint hover:text-foreground max-sm:min-h-[44px]"
        >
          <RotateCcw className="size-3" /> {t("eval.newEval")}
        </button>
      )}

      {!job && (
        <p className="mt-6 text-sm text-faint">
          {t("eval.idleHint")}
        </p>
      )}
    </div>
  );
}
