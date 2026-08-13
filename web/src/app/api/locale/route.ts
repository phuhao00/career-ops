import fs from "node:fs";
import yaml from "js-yaml";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { normalizeLocale } from "@/lib/i18n/locale.mjs";
import { profileYmlPath, readOutputLanguage } from "@/lib/i18n/profile-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function GET() {
  return Response.json({ output: readOutputLanguage() });
}

export async function POST(req: Request) {
  let body: { output?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const output = normalizeLocale(body.output);
  const file = profileYmlPath();
  if (!fs.existsSync(file)) {
    return Response.json({ ok: true, persisted: false, output });
  }
  let parsed: unknown;
  try {
    parsed = yaml.load(fs.readFileSync(file, "utf8"));
  } catch {
    return Response.json({ error: "config/profile.yml is not valid YAML — refusing to overwrite it." }, { status: 409 });
  }
  const base = isObj(parsed) ? parsed : {};
  const language = isObj(base.language) ? { ...base.language, output } : { output };
  try {
    atomicWriteWithBackup(file, yaml.dump({ ...base, language }, { lineWidth: 100, noRefs: true }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }
  return Response.json({ ok: true, persisted: true, output });
}
