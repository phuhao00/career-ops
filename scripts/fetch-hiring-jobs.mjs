#!/usr/bin/env node
/**
 * Harvest jobs from Shenzhen early-stage (board: hiring) official career pages.
 * Uses Playwright so Feishu / Moka SPAs actually render. Writes into
 * data/pipeline.md via the canonical scan.mjs appenders.
 *
 *   node scripts/fetch-hiring-jobs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  appendToPipeline,
  appendToScanHistory,
  loadSeenUrls,
  normalizeUrlForDedup,
} from '../scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LOCATION = '深圳';

const ATS_OVERRIDE = {
  自变量机器人: 'https://x2-robot.jobs.feishu.cn/index/position/list',
  众擎机器人: 'https://dx3a2bminsq.jobs.feishu.cn/index/position/list',
  诺因智能: 'https://knowinai.jobs.feishu.cn/index/position/list',
  星尘智能: 'https://app.mokahr.com/social-recruitment/astribot/144861?locale=zh-CN',
  跨维智能: 'https://app.mokahr.com/social-recruitment/dexforce/149227?locale=zh-CN',
  逐际动力: 'https://career.limxdynamics.com/index',
  智平方: 'https://ai2robotics.com/join/',
};

function loadHiringCompanies() {
  const doc = yaml.load(fs.readFileSync(path.join(ROOT, 'portals.yml'), 'utf8'));
  return (doc.tracked_companies || []).filter((c) => c?.board === 'hiring' && c.enabled !== false);
}

function locOf(job) {
  const city = job.city_info?.name || job.city?.name;
  if (city) return city;
  if (Array.isArray(job.city_list) && job.city_list[0]?.name) {
    return job.city_list.map((c) => c.name).filter(Boolean).join('/');
  }
  return DEFAULT_LOCATION;
}

function feishuJobsFromJson(json, pageUrl) {
  const list = json?.data?.job_post_list || json?.data?.list || json?.job_post_list || [];
  if (!Array.isArray(list)) return [];
  let portal = 'index';
  let host = pageUrl;
  try {
    const u = new URL(pageUrl);
    host = u.origin;
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs[0] && segs[0] !== 'api' && segs[0] !== 'v1') portal = segs[0];
  } catch {
    /* keep defaults */
  }
  return list
    .map((j) => {
      const id = j.id || j.job_post_id || j.job_id;
      const title = String(j.title || j.name || '').trim();
      if (!id || !title) return null;
      return {
        title,
        url: `${host}/${portal}/position/${id}/detail`,
        location: locOf(j),
      };
    })
    .filter(Boolean);
}

async function flushFeishu(pending) {
  await Promise.all(pending.splice(0));
}

async function harvestFeishu(page, startUrl) {
  const bag = new Map();
  const pending = [];
  let captured = '';
  let total = 0;
  page.on('response', (res) => {
    if (!res.url().includes('/api/v1/search/job/posts') || !res.ok()) return;
    captured = res.url();
    pending.push(
      (async () => {
        try {
          const json = await res.json();
          total = Number(json?.data?.count || json?.data?.total || json?.count || total) || total;
          for (const job of feishuJobsFromJson(json, startUrl)) bag.set(job.url, job);
        } catch {
          /* ignore non-json */
        }
      })(),
    );
  });

  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  await flushFeishu(pending);

  if (captured) {
    const limit = Number(new URL(captured).searchParams.get('limit') || 10);
    const max = Math.min(total || 400, 400);
    for (let offset = bag.size || limit; offset < max; offset += limit) {
      const u = new URL(captured);
      u.searchParams.set('offset', String(offset));
      u.searchParams.set('limit', String(limit));
      const json = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: 'include' });
        const t = await r.text();
        try {
          return JSON.parse(t);
        } catch {
          return null;
        }
      }, u.href);
      await flushFeishu(pending);
      const chunk = json ? feishuJobsFromJson(json, startUrl) : [];
      if (chunk.length === 0) break;
      for (const job of chunk) bag.set(job.url, job);
    }
  }

  const pages = Math.min(40, Math.ceil((total || bag.size) / 10) || 1);
  for (let p = 2; p <= pages; p++) {
    const before = bag.size;
    await page.evaluate(() => {
      for (const el of [document.documentElement, ...document.querySelectorAll('div')]) {
        if (el.scrollHeight > el.clientHeight + 80) el.scrollTop = el.scrollHeight;
      }
    });
    const waiter = page
      .waitForResponse((r) => r.url().includes('/api/v1/search/job/posts') && r.ok(), { timeout: 8000 })
      .catch(() => null);
    const num = page.getByText(String(p), { exact: true }).last();
    if (await num.count()) {
      await num.click({ timeout: 4000 }).catch(() => {});
    } else {
      await page.locator('.atsx-pagination-next').last().click({ timeout: 3000 }).catch(() => {});
    }
    await waiter;
    await flushFeishu(pending);
    if (bag.size === before) {
      const waiter2 = page
        .waitForResponse((r) => r.url().includes('/api/v1/search/job/posts') && r.ok(), { timeout: 5000 })
        .catch(() => null);
      await page.locator('.atsx-pagination-next').last().click({ timeout: 3000 }).catch(() => {});
      await waiter2;
      await flushFeishu(pending);
    }
    if (bag.size === before) break;
  }

  if (bag.size === 0) {
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .map((a) => ({ title: (a.innerText || '').trim().split('\n')[0], url: a.href }))
        .filter((x) => x.url.includes('/position/') && x.url.includes('/detail') && x.title.length > 1),
    );
    for (const j of links) {
      if (!bag.has(j.url)) bag.set(j.url, { ...j, location: DEFAULT_LOCATION });
    }
  }

  return [...bag.values()];
}

async function harvestMoka(page, startUrl) {
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3500);
  for (let i = 0; i < 15; i++) {
    const more = page.getByText(/加载更多|查看更多|下一页/);
    if (!(await more.count())) break;
    await more.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .map((a) => ({ title: (a.innerText || '').trim().split('\n')[0], url: a.href }))
      .filter((x) => {
        const t = x.title;
        if (!t || t.length < 2 || t.length > 80) return false;
        return /job|position|职位/i.test(x.url) || /工程师|研究员|经理|总监|专家|专员|算法/.test(t);
      }),
  );
  const seen = new Set();
  const out = [];
  for (const j of links) {
    let url = j.url;
    try {
      const u = new URL(url);
      const hm = u.hash.match(/\/(?:jobs?|position)\/([^/?#]+)/i);
      if (hm) {
        u.hash = '';
        u.searchParams.set('jid', hm[1]);
        url = u.href;
      }
    } catch {
      /* keep */
    }
    if (seen.has(url) || /查看|登录|注册/.test(j.title)) continue;
    seen.add(url);
    out.push({ title: j.title, url, location: DEFAULT_LOCATION });
  }
  return out;
}

async function harvestHtml(page, startUrl) {
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const host = new URL(startUrl).hostname;
  if (host.includes('ai2robotics.com')) {
    const res = await page.request.get('https://ai2robotics.com/wp-json/wp/v2/join?per_page=100');
    const items = await res.json();
    return (Array.isArray(items) ? items : []).map((p) => ({
      title: String(p.title?.rendered || '').trim(),
      url: p.link,
      location: DEFAULT_LOCATION,
    })).filter((j) => j.title && j.url);
  }
  return page.evaluate((base) => {
    const JOB = /工程师|研究员|经理|总监|专家|专员|架构师|科学家|设计师/;
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a')) {
      const title = (a.innerText || '').trim().split('\n')[0];
      if (!JOB.test(title) || seen.has(a.href)) continue;
      seen.add(a.href);
      out.push({ title, url: a.href, location: '深圳' });
    }
    if (out.length === 0) {
      for (const li of document.querySelectorAll('li')) {
        const title = (li.innerText || '').trim().split('\n')[0];
        if (!JOB.test(title) || seen.has(title)) continue;
        seen.add(title);
        const u = new URL(base);
        u.searchParams.set('role', title);
        out.push({ title, url: u.href, location: '深圳' });
      }
    }
    return out;
  }, startUrl);
}

async function harvestOne(browser, company) {
  const start = ATS_OVERRIDE[company.name] || company.careers_url;
  if (!start) return { company: company.name, jobs: [], note: 'no careers_url' };
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  let jobs = [];
  let kind = 'html';
  try {
    if (/jobs\.feishu\.cn|limxdynamics\.com\/|career\./i.test(start)) {
      kind = 'feishu';
      jobs = await harvestFeishu(page, start);
    } else if (/mokahr\.com/i.test(start)) {
      kind = 'moka';
      jobs = await harvestMoka(page, start);
    } else {
      jobs = await harvestHtml(page, start);
      const html = await page.content();
      const feishu = html.match(/https?:\/\/[a-z0-9-]+\.jobs\.feishu\.cn[^"' ]*/i);
      const moka = html.match(/https?:\/\/app\.mokahr\.com\/[^"' ]+/i);
      if (jobs.length === 0 && feishu) {
        kind = 'feishu';
        jobs = await harvestFeishu(page, feishu[0].replace(/&amp;/g, '&'));
      } else if (jobs.length === 0 && moka) {
        kind = 'moka';
        jobs = await harvestMoka(page, moka[0].replace(/&amp;/g, '&'));
      }
    }
    if (jobs.length === 0 && company.careers_url && company.careers_url !== start) {
      kind = 'html';
      jobs = await harvestHtml(page, company.careers_url);
    }
  } catch (err) {
    return { company: company.name, jobs: [], note: String(err.message || err), kind };
  } finally {
    await page.close().catch(() => {});
  }
  return { company: company.name, jobs, kind };
}

const { chromium } = await import('playwright');
const companies = loadHiringCompanies();
console.log(`Harvesting ${companies.length} hiring-board companies…`);

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const c of companies) {
    process.stdout.write(`  ${c.name} … `);
    const r = await harvestOne(browser, c);
    results.push(r);
    console.log(`${r.jobs.length} jobs${r.note ? ` (${r.note})` : ''} [${r.kind || ''}]`);
  }
} finally {
  await browser.close();
}

const { seen } = loadSeenUrls();
const offers = [];
for (const r of results) {
  for (const j of r.jobs) {
    if (!j?.url || !j.title) continue;
    const key = normalizeUrlForDedup(j.url);
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({
      url: j.url,
      company: r.company,
      title: j.title,
      location: j.location || DEFAULT_LOCATION,
      source: 'hiring-board',
    });
  }
}

if (offers.length) {
  await appendToPipeline(offers);
  await appendToScanHistory(offers, new Date().toISOString().slice(0, 10), 'added');
}

console.log('\nSummary');
for (const r of results) {
  console.log(`  ${r.company}: ${r.jobs.length}`);
}
console.log(`New offers written: ${offers.length}`);
