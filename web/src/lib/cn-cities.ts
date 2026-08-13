/**
 * China city aliases for location-targeted search.
 * Keep in sync with lib/cn-cities.mjs (scanner --location).
 */

export type CnCity = { label: string; aliases: string[] };

export const CN_CITIES: CnCity[] = [
  { label: "深圳", aliases: ["深圳", "Shenzhen"] },
  { label: "北京", aliases: ["北京", "Beijing"] },
  { label: "上海", aliases: ["上海", "Shanghai"] },
  { label: "杭州", aliases: ["杭州", "Hangzhou"] },
  { label: "广州", aliases: ["广州", "Guangzhou"] },
  { label: "成都", aliases: ["成都", "Chengdu"] },
  { label: "南京", aliases: ["南京", "Nanjing"] },
  { label: "武汉", aliases: ["武汉", "Wuhan"] },
  { label: "苏州", aliases: ["苏州", "Suzhou"] },
  { label: "西安", aliases: ["西安", "Xi'an", "Xian"] },
  { label: "重庆", aliases: ["重庆", "Chongqing"] },
  { label: "香港", aliases: ["香港", "Hong Kong", "Hongkong"] },
];

function norm(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/市$/u, "");
}

export function findCity(token: string): CnCity | null {
  const n = norm(token);
  if (!n) return null;
  return CN_CITIES.find((c) => c.aliases.some((a) => norm(a) === n) || norm(c.label) === n) || null;
}

export function expandLocationQuery(raw: string): string[] {
  const tokens = String(raw || "")
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (v: string) => {
    const key = v.toLowerCase();
    if (!v || seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  for (const t of tokens) {
    const city = findCity(t);
    if (city) city.aliases.forEach(add);
    else {
      add(t);
      const stripped = t.replace(/市$/u, "");
      if (stripped !== t) add(stripped);
    }
  }
  return out;
}

export function locationMatchesCity(location: string, labelOrCity: string | CnCity): boolean {
  const city = typeof labelOrCity === "string" ? findCity(labelOrCity) || { label: labelOrCity, aliases: [labelOrCity] } : labelOrCity;
  const hay = String(location || "").toLowerCase();
  if (!hay) return false;
  return city.aliases.some((a) => hay.includes(a.toLowerCase()));
}

/** Cities that appear in a list of location strings, highest count first. */
export function citiesPresent(locations: Iterable<string>): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const loc of locations) {
    for (const c of CN_CITIES) {
      if (locationMatchesCity(loc, c)) counts.set(c.label, (counts.get(c.label) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh"));
}

/** Which city chips are active given an allow/alwaysAllow keyword list. */
export function citiesFromKeywords(keywords: string[]): string[] {
  const lower = keywords.map((k) => k.toLowerCase());
  return CN_CITIES.filter((c) => c.aliases.some((a) => lower.includes(a.toLowerCase()))).map((c) => c.label);
}
