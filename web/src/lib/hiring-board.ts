import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { careerOpsRoot, readInbox, type InboxJob } from "@/lib/career-ops";

export type HiringJob = {
  url: string;
  role: string;
  location?: string;
  done: boolean;
};

export type HiringCompany = {
  name: string;
  careersUrl?: string;
  domain?: string;
  cohort: "A" | "B";
  stage?: string;
  founded?: string;
  jobs: HiringJob[];
};

export type HiringBoard = {
  companies: HiringCompany[];
  openJobs: number;
};

function hostname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function asCohort(v: unknown): "A" | "B" | null {
  const s = String(v || "").trim().toUpperCase();
  return s === "A" || s === "B" ? s : null;
}

/** Companies tagged `board: hiring` in portals.yml, joined with pipeline.md jobs. */
export function loadHiringBoard(): HiringBoard {
  let raw: unknown;
  try {
    raw = yaml.load(fs.readFileSync(path.join(careerOpsRoot(), "portals.yml"), "utf8"));
  } catch {
    return { companies: [], openJobs: 0 };
  }
  const doc = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const listed = Array.isArray(doc.tracked_companies) ? doc.tracked_companies : [];

  const inbox = readInbox();
  const byCompany = new Map<string, InboxJob[]>();
  for (const job of inbox) {
    const key = job.company.trim().toLowerCase();
    if (!key) continue;
    const arr = byCompany.get(key) ?? [];
    arr.push(job);
    byCompany.set(key, arr);
  }

  const companies: HiringCompany[] = [];
  for (const entry of listed) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (String(row.board || "") !== "hiring") continue;
    if (row.enabled === false) continue;
    const name = String(row.name || "").trim();
    if (!name) continue;
    const cohort = asCohort(row.cohort) ?? "B";
    const careersUrl = typeof row.careers_url === "string" ? row.careers_url : undefined;
    const jobs = (byCompany.get(name.toLowerCase()) ?? []).map((j) => ({
      url: j.url,
      role: j.role,
      location: j.location,
      done: j.done,
    }));
    companies.push({
      name,
      careersUrl,
      domain: hostname(careersUrl),
      cohort,
      stage: row.stage ? String(row.stage) : undefined,
      founded: row.founded ? String(row.founded) : undefined,
      jobs,
    });
  }

  const openJobs = companies.reduce((n, c) => n + c.jobs.filter((j) => !j.done).length, 0);
  return { companies, openJobs };
}
