// Dev-only seed script: posts a realistic ~30 day dataset to /api/track so the
// /reports dashboard has something meaningful to show locally.
//
// Usage:
//   node scripts/seed.mjs [baseUrl] [key]
//   BASE=http://localhost:8788 KEY=retro-preview-stats node scripts/seed.mjs
//
// Requires the dev server (`npm run dev`) to be running.

const BASE = process.argv[2] || process.env.BASE || 'http://localhost:8788';
const KEY = process.argv[3] || process.env.KEY || 'retro-preview-stats';
const ENDPOINT = `${BASE.replace(/\/$/, '')}/api/track`;
const DAYS = Number(process.env.DAYS || 30);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const REFERRERS = [
  '', '', '', // direct-heavy
  'https://www.google.com/',
  'https://www.reddit.com/r/nostalgia/',
  'https://www.facebook.com/',
  'https://t.co/abc123',
  'https://www.instagram.com/',
  'https://www.pinterest.com/pin/1',
  'https://www.tiktok.com/@someone',
  'https://news.ycombinator.com/',
];
const UTM = [null, null, null, null, 'reddit', 'newsletter', 'tiktok', 'producthunt', 'instagram'];
const DEVICES = ['mobile', 'mobile', 'mobile', 'desktop', 'desktop', 'tablet'];
const MODES = ['solo', 'solo', 'solo', 'solo', 'class', 'class', 'pet', 'pet', 'super'];

function post(evt) {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...evt, key: KEY }),
  });
}

async function runPool(tasks, concurrency = 24) {
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try { await tasks[idx](); } catch (e) { /* ignore individual failures */ }
      done++;
      if (done % 200 === 0) process.stdout.write(`  ...${done}/${tasks.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  const now = Date.now();
  const dayMs = 86400000;
  const tasks = [];
  let sessionCounter = 0;

  for (let d = DAYS - 1; d >= 0; d--) {
    const dow = new Date(now - d * dayMs).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const base = weekend ? randInt(14, 26) : randInt(22, 44);
    // gentle upward trend toward recent days
    const trend = Math.round(((DAYS - d) / DAYS) * 12);
    const sessions = base + trend;

    for (let s = 0; s < sessions; s++) {
      const sid = `seed-${d}-${sessionCounter++}`;
      const device = pick(DEVICES);
      const referrer = pick(REFERRERS);
      const utm_source = pick(UTM);
      const ts = now - d * dayMs - randInt(0, dayMs - 1);
      const common = { path: '/', referrer, utm_source, device, session: sid, ts };

      tasks.push(() => post({ ...common, type: 'pageview' }));

      if (chance(0.55)) {
        const mode = pick(MODES);
        tasks.push(() => post({ ...common, type: 'mode_select', mode, ts: ts + 1000 }));
        tasks.push(() => post({ ...common, type: 'upload', mode, ts: ts + 4000 }));

        if (chance(0.7)) {
          tasks.push(() => post({ ...common, type: 'generate', mode, ts: ts + 9000 }));
          if (chance(0.6)) {
            tasks.push(() => post({ ...common, type: 'download', mode, ts: ts + 15000 }));
          }
          if (mode === 'solo' && chance(0.12)) {
            tasks.push(() => post({ ...common, type: 'gif', mode, ts: ts + 20000 }));
          }
        }
      }
    }
  }

  console.log(`Seeding ${tasks.length} events to ${ENDPOINT} over ${DAYS} days...`);
  const health = await post({ type: 'pageview', session: 'seed-health', ts: now }).catch(() => null);
  if (!health || !health.ok) {
    console.error(`\nCould not reach ${ENDPOINT}. Is the dev server running? (npm run dev)`);
    process.exit(1);
  }
  await runPool(tasks);
  console.log(`Done. Open ${BASE}/reports?key=${KEY}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
