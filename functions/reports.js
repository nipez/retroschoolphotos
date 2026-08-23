// GET /reports?key=... — internal analytics dashboard for Retro School Photos.
// Server-rendered HTML built from aggregations over the D1 `events` table.

import { ensureSchema, reportsKey } from './_lib/analytics.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';

  if (key !== reportsKey(env)) {
    return new Response(unauthorizedPage(), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const db = env && env.DB;
  if (!db) {
    return new Response('<h1>Analytics store not configured</h1>', {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  await ensureSchema(db);

  const [
    totalsByType,
    sessionsRes,
    funnelRes,
    pvByDay,
    sessByDay,
    modesRes,
    devicesRes,
    topPagesRes,
    referrersRes,
    utmRes,
    rangeRes,
  ] = await db.batch([
    db.prepare(`SELECT type, COUNT(*) c FROM events GROUP BY type`),
    db.prepare(`SELECT COUNT(DISTINCT session) c FROM events WHERE session IS NOT NULL`),
    db.prepare(
      `SELECT type, COUNT(DISTINCT session) c FROM events
       WHERE type IN ('pageview','upload','generate','download') AND session IS NOT NULL
       GROUP BY type`
    ),
    db.prepare(`SELECT day, COUNT(*) c FROM events WHERE type='pageview' GROUP BY day ORDER BY day`),
    db.prepare(`SELECT day, COUNT(DISTINCT session) c FROM events WHERE session IS NOT NULL GROUP BY day ORDER BY day`),
    db.prepare(`SELECT mode, COUNT(*) c FROM events WHERE type='generate' AND mode IS NOT NULL GROUP BY mode ORDER BY c DESC`),
    db.prepare(`SELECT device, COUNT(DISTINCT session) c FROM events WHERE session IS NOT NULL GROUP BY device ORDER BY c DESC`),
    db.prepare(`SELECT path, COUNT(*) c FROM events WHERE type='pageview' GROUP BY path ORDER BY c DESC LIMIT 10`),
    db.prepare(
      `SELECT CASE WHEN referrer_host IS NULL OR referrer_host='' THEN '(direct)' ELSE referrer_host END host,
              COUNT(*) c FROM events WHERE type='pageview' GROUP BY host ORDER BY c DESC LIMIT 10`
    ),
    db.prepare(`SELECT utm_source, COUNT(*) c FROM events WHERE utm_source IS NOT NULL GROUP BY utm_source ORDER BY c DESC LIMIT 10`),
    db.prepare(`SELECT MIN(day) mn, MAX(day) mx, COUNT(*) total FROM events`),
  ]);

  const totals = Object.fromEntries((totalsByType.results || []).map((r) => [r.type, r.c]));
  const funnel = Object.fromEntries((funnelRes.results || []).map((r) => [r.type, r.c]));
  const sessions = (sessionsRes.results?.[0]?.c) || 0;
  const range = rangeRes.results?.[0] || {};

  const pageviews = totals.pageview || 0;
  const generates = totals.generate || 0;
  const downloads = totals.download || 0;
  const uploads = totals.upload || 0;
  const genRate = pageviews ? Math.round((generates / pageviews) * 100) : 0;

  const html = page({
    key,
    range,
    kpis: [
      { label: 'Pageviews', value: pageviews, tone: 'mint' },
      { label: 'Unique visitors', value: sessions, tone: 'blue' },
      { label: 'Photos generated', value: generates, tone: 'lav' },
      { label: 'Downloads', value: downloads, tone: 'peach' },
      { label: 'Generate rate', value: genRate, suffix: '%', tone: 'pink' },
    ],
    funnel,
    pageviews,
    uploads,
    generates,
    downloads,
    pvByDay: pvByDay.results || [],
    sessByDay: sessByDay.results || [],
    modes: modesRes.results || [],
    devices: devicesRes.results || [],
    topPages: topPagesRes.results || [],
    referrers: referrersRes.results || [],
    utm: utmRes.results || [],
  });

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/* ---------- rendering helpers ---------- */

const ACCENTS = {
  mint: '#2bb3a3',
  blue: '#5b8def',
  lav: '#8b7cf6',
  peach: '#f0a860',
  pink: '#e879a6',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function barRows(rows, labelKey, accent) {
  if (!rows.length) return `<div class="empty">No data yet</div>`;
  const max = Math.max(1, ...rows.map((r) => r.c));
  return rows
    .map((r) => {
      const label = r[labelKey];
      const w = ((r.c / max) * 100).toFixed(1);
      return `<div class="row">
        <div class="row-label" title="${esc(label)}">${esc(label || '—')}</div>
        <div class="row-track"><span style="width:${w}%;background:${accent}"></span></div>
        <div class="row-val">${fmt(r.c)}</div>
      </div>`;
    })
    .join('');
}

function dayChart(rows, accent) {
  if (!rows.length) return `<div class="empty">No data yet</div>`;
  const max = Math.max(1, ...rows.map((r) => r.c));
  const bars = rows
    .map((r) => {
      const h = ((r.c / max) * 100).toFixed(1);
      return `<div class="col" title="${esc(r.day)}: ${fmt(r.c)}"><span style="height:${h}%;background:${accent}"></span></div>`;
    })
    .join('');
  return `<div class="chart">${bars}</div>
    <div class="chart-axis"><span>${esc(rows[0].day)}</span><span>${esc(rows[rows.length - 1].day)}</span></div>`;
}

function funnelHtml(funnel, pageviews) {
  const steps = [
    ['pageview', 'Visited site'],
    ['upload', 'Uploaded a photo'],
    ['generate', 'Generated photo'],
    ['download', 'Downloaded / saved'],
  ];
  const top = funnel.pageview || pageviews || 0;
  return steps
    .map(([k, label], i) => {
      const v = funnel[k] || 0;
      const pct = top ? Math.round((v / top) * 100) : 0;
      const accent = Object.values(ACCENTS)[i];
      return `<div class="funnel-step">
        <div class="funnel-top"><span>${label}</span><span class="funnel-nums">${fmt(v)} · ${pct}%</span></div>
        <div class="funnel-track"><span style="width:${pct}%;background:${accent}"></span></div>
      </div>`;
    })
    .join('');
}

function kpiCards(kpis) {
  return kpis
    .map(
      (k) => `<div class="kpi kpi-${k.tone}">
        <div class="kpi-value">${fmt(k.value)}${k.suffix || ''}</div>
        <div class="kpi-label">${esc(k.label)}</div>
      </div>`
    )
    .join('');
}

function card(title, subtitle, inner) {
  return `<section class="card">
    <div class="card-head"><h2>${esc(title)}</h2>${subtitle ? `<span class="card-sub">${esc(subtitle)}</span>` : ''}</div>
    ${inner}
  </section>`;
}

function page(d) {
  const rangeText = d.range && d.range.mn ? `${d.range.mn} → ${d.range.mx}` : 'No events yet';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Retro School Photos — insights</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f7f3ec; color: #2c2a33; line-height: 1.45;
    padding: 28px 20px 60px;
  }
  .wrap { max-width: 1040px; margin: 0 auto; }
  header.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
  header.top h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; }
  header.top p { color: #7c7889; font-size: 0.85rem; margin-top: 2px; }
  .range-pill { background: #fff; border: 1px solid #e7e1d6; border-radius: 999px; padding: 7px 16px; font-size: 0.8rem; color: #59565f; display: flex; gap: 12px; align-items: center; }
  .range-pill a { color: #2bb3a3; text-decoration: none; font-weight: 600; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 22px; }
  .kpi { background: #fff; border: 1px solid #ece6db; border-radius: 14px; padding: 16px 16px 14px; }
  .kpi-value { font-size: 1.55rem; font-weight: 700; letter-spacing: -0.02em; }
  .kpi-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: #8b8797; margin-top: 4px; }
  .kpi-mint { box-shadow: inset 0 3px 0 #2bb3a3; }
  .kpi-blue { box-shadow: inset 0 3px 0 #5b8def; }
  .kpi-lav  { box-shadow: inset 0 3px 0 #8b7cf6; }
  .kpi-peach{ box-shadow: inset 0 3px 0 #f0a860; }
  .kpi-pink { box-shadow: inset 0 3px 0 #e879a6; }
  .card { background: #fff; border: 1px solid #ece6db; border-radius: 16px; padding: 18px 20px 20px; margin-bottom: 16px; }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
  .card-head h2 { font-size: 1rem; font-weight: 700; }
  .card-sub { font-size: 0.75rem; color: #9a96a5; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .row { display: grid; grid-template-columns: 150px 1fr 52px; align-items: center; gap: 10px; margin: 7px 0; }
  .row-label { font-size: 0.82rem; color: #4b4857; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-track { background: #f0ece3; border-radius: 6px; height: 12px; overflow: hidden; }
  .row-track span { display: block; height: 100%; border-radius: 6px; }
  .row-val { font-size: 0.82rem; text-align: right; color: #2c2a33; font-variant-numeric: tabular-nums; }
  .funnel-step { margin: 12px 0; }
  .funnel-top { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px; }
  .funnel-nums { color: #7c7889; font-variant-numeric: tabular-nums; }
  .funnel-track { background: #f0ece3; border-radius: 8px; height: 18px; overflow: hidden; }
  .funnel-track span { display: block; height: 100%; border-radius: 8px; }
  .chart { display: flex; align-items: flex-end; gap: 3px; height: 130px; padding-top: 6px; }
  .chart .col { flex: 1; display: flex; align-items: flex-end; height: 100%; }
  .chart .col span { display: block; width: 100%; border-radius: 3px 3px 0 0; min-height: 2px; }
  .chart-axis { display: flex; justify-content: space-between; font-size: 0.7rem; color: #a8a4b2; margin-top: 6px; }
  .empty { color: #b0acb9; font-size: 0.85rem; padding: 10px 0; }
  footer.foot { text-align: center; color: #b0acb9; font-size: 0.75rem; margin-top: 26px; }
  @media (max-width: 760px) {
    .kpis { grid-template-columns: repeat(2, 1fr); }
    .grid2 { grid-template-columns: 1fr; }
    .row { grid-template-columns: 110px 1fr 46px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div>
      <h1>Retro School Photos insights</h1>
      <p>Internal preview stats from your Cloudflare Pages funnel</p>
    </div>
    <div class="range-pill"><span>${esc(rangeText)}</span><a href="?key=${encodeURIComponent(d.key)}">Refresh</a></div>
  </header>

  <div class="kpis">${kpiCards(d.kpis)}</div>

  ${card('Preview funnel', 'unique visitors per step', `<div class="funnel">${funnelHtml(d.funnel, d.pageviews)}</div>`)}

  <div class="grid2">
    ${card('Top pages', 'by pageviews', barRows(d.topPages, 'path', ACCENTS.mint))}
    ${card('UTM sources', 'tagged campaigns', barRows(d.utm, 'utm_source', ACCENTS.lav))}
  </div>

  ${card('Pageviews per day', '', dayChart(d.pvByDay, ACCENTS.blue))}

  <div class="grid2">
    ${card('Generations by mode', 'solo · class · pet · super', barRows(d.modes, 'mode', ACCENTS.peach))}
    ${card('Devices', 'unique visitors', barRows(d.devices, 'device', ACCENTS.pink))}
  </div>

  ${card('Visitors per day', 'unique sessions', dayChart(d.sessByDay, ACCENTS.mint))}

  ${card('Top referrers', 'where visitors come from', barRows(d.referrers, 'host', ACCENTS.blue))}

  <footer class="foot">retroschoolphotos.com · internal analytics · generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC</footer>
</div>
</body>
</html>`;
}

function unauthorizedPage() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Not authorized</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f3ec;color:#2c2a33;display:flex;min-height:80vh;align-items:center;justify-content:center;text-align:center;padding:20px}div{max-width:360px}h1{font-size:1.2rem;margin-bottom:8px}p{color:#7c7889;font-size:0.9rem}</style>
</head><body><div><h1>Access key required</h1><p>Add <code>?key=YOUR_KEY</code> to the URL to view internal analytics.</p></div></body></html>`;
}
