/**
 * eval-pipeline.mjs — map a live evaluate/pdf worker onto the six-step
 * auto-pipeline the docs promise (read JD → CV → score → report → tracker → PDF).
 *
 * The web evaluate worker does A–G + tracker persistence; PDF is a separate
 * `kind: "pdf"` worker the UI can fire afterwards. This module is the single
 * place that turns raw tool-name steps into those human stages so the Evaluate
 * page, the job detail, and tests cannot drift.
 */

/** @typedef {"pending" | "active" | "done" | "error" | "ready"} StageStatus */
/** @typedef {"jd" | "cv" | "score" | "report" | "tracker" | "pdf"} StageId */

/** @type {ReadonlyArray<{id: StageId, title: string, summary: string, reads: string, writes: string}>} */
export const STAGES = [
  {
    id: "jd",
    title: "Read the posting",
    summary: "Understands the role, requirements, and compensation.",
    reads: "Job URL or pasted description",
    writes: "Role picture (not yet on disk)",
  },
  {
    id: "cv",
    title: "Read your CV",
    summary: "Pulls from cv.md to find matches and gaps against the role.",
    reads: "cv.md · config/profile.yml · modes/_profile.md",
    writes: "Fit table (Block B raw material)",
  },
  {
    id: "score",
    title: "Score the job",
    summary: "Rates the role from 0 to 5 across fit, compensation, and remote policy.",
    reads: "Posting + CV match",
    writes: "Score in the report header",
  },
  {
    id: "report",
    title: "Write the report",
    summary: "Saves a detailed A–G breakdown to the reports/ folder.",
    reads: "Score and evidence",
    writes: "reports/{n}-{company}-{date}.md",
  },
  {
    id: "tracker",
    title: "Add to tracker",
    summary: "Logs the application in data/applications.md as Evaluated.",
    reads: "Report number, company, role, score",
    writes: "data/applications.md",
  },
  {
    id: "pdf",
    title: "Tailored PDF resume",
    summary: "Outputs a CV customized for this job to output/. You review before sending.",
    reads: "cv.md + this role's keywords",
    writes: "output/ tailored PDF",
  },
];

const INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

/** Tool name (and a few humanized status labels) → pipeline stage. */
const TOOL_STAGE = {
  WebFetch: "jd",
  WebSearch: "jd",
  browser_navigate: "jd",
  browser_snapshot: "jd",
  Read: "cv",
  Glob: "cv",
  Grep: "cv",
  Write: "report",
  Edit: "report",
  NotebookEdit: "report",
  Bash: "tracker",
};

/**
 * @param {string | undefined} label
 * @returns {StageId | null}
 */
export function classifyLabel(label) {
  if (!label) return null;
  if (TOOL_STAGE[label]) return TOOL_STAGE[label];
  const l = label.toLowerCase();
  if (/fetch|posting|listing|navigate|snapshot|\bjd\b/.test(l)) return "jd";
  if (/\bcv\b|profile|resume/.test(l)) return "cv";
  if (/verdict|score the|scoring/.test(l)) return "score";
  if (/report|writing the report/.test(l)) return "report";
  if (/tracker|merge-tracker|saving to your tracker/.test(l)) return "tracker";
  if (/\bpdf\b|cv html|tailored cv/.test(l)) return "pdf";
  return null;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
export function looksLikeJobUrl(raw) {
  return /^https?:\/\/\S+$/i.test(String(raw ?? "").trim());
}

/**
 * Auto-detect URL vs pasted JD. Short non-URL strings are invalid (not enough
 * to evaluate); a URL-shaped first line counts as a URL even with trailing notes.
 *
 * @param {string} raw
 * @returns {{ ok: true, mode: "url" | "jd", value: string } | { ok: false, code: "empty" | "badUrl" | "tooShort", error: string }}
 */
export function classifyInput(raw) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return { ok: false, code: "empty", error: "Paste a job-posting URL (https://…) or the full job description." };
  }
  const first = value.split(/\s+/, 1)[0];
  if (/^https?:\/\//i.test(first)) {
    if (!looksLikeJobUrl(first) && !/^https?:\/\/\S+/i.test(value)) {
      return { ok: false, code: "badUrl", error: "That doesn't look like a full URL. Switch to pasted JD if you have the text." };
    }
    return { ok: true, mode: "url", value };
  }
  if (value.length < 80 && !value.includes("\n")) {
    return { ok: false, code: "tooShort", error: "Paste a full https:// URL, or the complete job description." };
  }
  return { ok: true, mode: "jd", value };
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractReportNum(text) {
  if (!text) return null;
  const m = String(text).match(/reports\/(\d{3})-/);
  return m ? m[1] : null;
}

function hasVerdict(job) {
  if (job?.result?.score != null) return true;
  return /VERDICT:\s*[\d.]+/i.test(job?.text || "");
}

/**
 * @param {{ status?: string, steps?: Array<{label?: string}>, text?: string, result?: {score?: number | null} } | null | undefined} job
 * @param {{ status?: string } | null | undefined} pdfJob
 * @returns {{ stages: Array<{id: StageId, title: string, summary: string, reads: string, writes: string, status: StageStatus}>, activeIndex: number }}
 */
export function derivePipeline(job, pdfJob) {
  const stages = STAGES.map((s) => ({ ...s, status: /** @type {StageStatus} */ ("pending") }));
  if (!job) return { stages, activeIndex: -1 };

  const reached = new Set();
  let lastIdx = -1;
  for (const step of job.steps || []) {
    const id = classifyLabel(step.label);
    if (!id) continue;
    reached.add(id);
    lastIdx = Math.max(lastIdx, INDEX[id]);
  }
  if (hasVerdict(job)) reached.add("score");

  if (job.status === "done") {
    for (const id of ["jd", "cv", "score", "report", "tracker"]) reached.add(id);
  }

  for (const s of stages) {
    if (s.id === "pdf") continue;
    if (reached.has(s.id)) s.status = "done";
  }

  if (job.status === "running") {
    const lastLabel = job.steps?.[job.steps.length - 1]?.label;
    let current = classifyLabel(lastLabel);
    if (!current && reached.size === 0) current = "jd";
    if (!current && reached.has("cv") && !reached.has("score")) current = "score";
    if (current && current !== "pdf") {
      stages[INDEX[current]].status = "active";
    }
  }

  if (job.status === "error") {
    const idx = lastIdx >= 0 ? lastIdx : 0;
    stages[idx].status = "error";
  }

  const pdf = stages[INDEX.pdf];
  if (pdfJob?.status === "running") pdf.status = "active";
  else if (pdfJob?.status === "done") pdf.status = "done";
  else if (pdfJob?.status === "error") pdf.status = "error";
  else if (job.status === "done") pdf.status = "ready";

  const activeIndex = stages.findIndex((s) => s.status === "active");
  return { stages, activeIndex };
}
