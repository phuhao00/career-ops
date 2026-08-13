#!/usr/bin/env node
/**
 * Local career-page parser for China company sites that have no Greenhouse/Lever API.
 * Used by portals.yml `parser:` (jobs-json-v1 on stdout).
 *
 * Usage: node scripts/parsers/cn-careers.mjs <careers_url> [default_location]
 */
const JOB_TITLE =
  /(?:工程师|研究员|经理|总监|专员|专家|架构师|科学家|设计师|产品经理)$/;
const JUNK = /查看在招|了解更多|立即|欢迎加入|加入地瓜|^加入/;
const NAV = /^(?:加入我们|关于我们|首页|联系我们|产品|新闻|招聘|职位|热招岗位|虚席以待|投递方式|社招|校招)$/;

const url = process.argv[2];
const defaultLocation = process.argv[3] || '';

if (!url || !/^https?:\/\//i.test(url)) {
  console.error('cn-careers: careers_url must be http(s)');
  process.exit(1);
}

function decode(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function job(title, jobUrl, location) {
  const t = decode(title);
  if (!t || NAV.test(t) || JUNK.test(t) || !JOB_TITLE.test(t) || t.length < 2 || t.length > 80) return null;
  if (!jobUrl) return null;
  return { title: t, url: jobUrl, location: location || defaultLocation };
}

async function fetchText(target) {
  const res = await fetch(target, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; career-ops-parser/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return { res, text, finalUrl: res.url };
}

function fromWpJoin(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((p) => job(p?.title?.rendered || p?.title, p?.link, defaultLocation))
    .filter(Boolean);
}

function fromRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1];
    const link = (block.match(/<link>(.*?)<\/link>/) || [])[1];
    const j = job(title, link, defaultLocation);
    if (j) items.push(j);
  }
  return items;
}

function fromHtml(html, base) {
  const out = [];
  const seen = new Set();

  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const title = decode(m[2]);
    if (!JOB_TITLE.test(title)) continue;
    let abs;
    try {
      abs = new URL(href, base).href;
    } catch {
      continue;
    }
    if (/#|javascript:|mailto:/i.test(abs) && !JOB_TITLE.test(title)) continue;
    const j = job(title, abs, defaultLocation);
    if (j && !seen.has(j.title)) {
      seen.add(j.title);
      out.push(j);
    }
  }

  if (out.length === 0) {
    for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const title = decode(m[1]);
      if (!JOB_TITLE.test(title) || NAV.test(title)) continue;
      const page = new URL(base);
      page.hash = '';
      page.searchParams.set('role', title);
      const abs = page.href;
      const j = job(title, abs, defaultLocation);
      if (j && !seen.has(j.title)) {
        seen.add(j.title);
        out.push(j);
      }
    }
  }

  return out;
}

async function extract(target) {
  const parsed = new URL(target);

  if (/\/wp-json\/wp\/v2\/join/i.test(target)) {
    const { text } = await fetchText(target);
    return fromWpJoin(JSON.parse(text));
  }

  if (parsed.hostname.endsWith('ai2robotics.com')) {
    const api = `${parsed.origin}/wp-json/wp/v2/join?per_page=100`;
    const { text } = await fetchText(api);
    const jobs = fromWpJoin(JSON.parse(text));
    if (jobs.length) return jobs;
  }

  const { text, res, finalUrl } = await fetchText(target);
  const type = res.headers.get('content-type') || '';

  if (/xml|rss|atom/i.test(type) || /<rss[\s>]/i.test(text)) {
    return fromRss(text);
  }

  if (/json/i.test(type)) {
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : data.jobs || data.results || data.data || [];
      if (Array.isArray(arr) && arr[0]?.title?.rendered) return fromWpJoin(arr);
    } catch {
      /* fall through to HTML */
    }
  }

  const origin = new URL(finalUrl).origin;
  if (/wp-json|wordpress/i.test(text) || text.includes('/join/')) {
    try {
      const { text: wp } = await fetchText(`${origin}/wp-json/wp/v2/join?per_page=100`);
      const jobs = fromWpJoin(JSON.parse(wp));
      if (jobs.length) return jobs;
    } catch {
      /* ignore */
    }
  }

  return fromHtml(text, finalUrl);
}

const jobs = await extract(url);
const uniq = [];
const seen = new Set();
for (const j of jobs) {
  const key = `${j.title}|${j.url}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniq.push(j);
}
process.stdout.write(JSON.stringify(uniq));
