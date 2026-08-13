/**
 * China city aliases for location-targeted search.
 * Used by scan.mjs --location and kept in sync with web/src/lib/cn-cities.ts.
 * Matching is case-insensitive substring — "中国-深圳" hits 深圳.
 */

export const CN_CITIES = [
  { label: '深圳', aliases: ['深圳', 'Shenzhen'] },
  { label: '北京', aliases: ['北京', 'Beijing'] },
  { label: '上海', aliases: ['上海', 'Shanghai'] },
  { label: '杭州', aliases: ['杭州', 'Hangzhou'] },
  { label: '广州', aliases: ['广州', 'Guangzhou'] },
  { label: '成都', aliases: ['成都', 'Chengdu'] },
  { label: '南京', aliases: ['南京', 'Nanjing'] },
  { label: '武汉', aliases: ['武汉', 'Wuhan'] },
  { label: '苏州', aliases: ['苏州', 'Suzhou'] },
  { label: '西安', aliases: ['西安', "Xi'an", 'Xian'] },
  { label: '重庆', aliases: ['重庆', 'Chongqing'] },
  { label: '香港', aliases: ['香港', 'Hong Kong', 'Hongkong'] },
];

function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/市$/u, '');
}

export function findCity(token) {
  const n = norm(token);
  if (!n) return null;
  return CN_CITIES.find((c) => c.aliases.some((a) => norm(a) === n) || norm(c.label) === n) || null;
}

/** Expand "深圳" / "深圳,上海" into every alias the location_filter should keep. */
export function expandLocationQuery(raw) {
  const tokens = String(raw || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  const add = (v) => {
    const key = String(v).toLowerCase();
    if (!v || seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  for (const t of tokens) {
    const city = findCity(t);
    if (city) city.aliases.forEach(add);
    else {
      add(t);
      const stripped = t.replace(/市$/u, '');
      if (stripped !== t) add(stripped);
    }
  }
  return out;
}

export function locationMatchesCity(location, labelOrCity) {
  const city = typeof labelOrCity === 'string' ? findCity(labelOrCity) || { aliases: [labelOrCity] } : labelOrCity;
  const hay = String(location || '').toLowerCase();
  if (!hay) return false;
  return (city.aliases || []).some((a) => hay.includes(String(a).toLowerCase()));
}
