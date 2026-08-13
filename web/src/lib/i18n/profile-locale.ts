import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { normalizeLocale } from "@/lib/i18n/locale.mjs";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function profileYmlPath(): string {
  return path.join(careerOpsRoot(), "config", "profile.yml");
}

/** language.output from the user-layer profile, or null if unset / unreadable. */
export function readOutputLanguage(): string | null {
  try {
    const parsed = yaml.load(fs.readFileSync(profileYmlPath(), "utf8"));
    if (!isObj(parsed) || !isObj(parsed.language)) return null;
    const out = parsed.language.output;
    return typeof out === "string" && out.trim() ? normalizeLocale(out) : null;
  } catch {
    return null;
  }
}
