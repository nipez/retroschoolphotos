/** Shared yearbook helpers for Pages Functions. */

export const MAX_BYTES = Math.floor(1.2 * 1024 * 1024); // ~1.2MB
export const MAX_INDEX = 200;
export const RATE_LIMIT = 8; // posts per IP per hour
export const RATE_WINDOW_SEC = 3600;
export const MAX_NAME_LEN = 40;

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

export function corsHeaders(origin) {
  const allow = origin && /^https?:\/\//.test(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(data, status, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

export function isJpeg(bytes) {
  if (!bytes || bytes.byteLength < 3) return false;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return JPEG_MAGIC.every((b, i) => u8[i] === b);
}

export function sanitizeName(raw) {
  if (raw == null) return '';
  const s = String(raw).trim().slice(0, MAX_NAME_LEN);
  // Strip control chars; keep letters/numbers/spaces/basic punctuation
  return s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[<>]/g, '');
}

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function checkRateLimit(env, ip) {
  const kv = env.YEARBOOK;
  if (!kv) return { ok: false, error: 'Yearbook storage is not configured' };
  const key = `rate:${ip}`;
  const raw = await kv.get(key);
  let count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= RATE_LIMIT) {
    return { ok: false, error: 'Too many yearbook uploads. Try again later.' };
  }
  count += 1;
  await kv.put(key, String(count), { expirationTtl: RATE_WINDOW_SEC });
  return { ok: true };
}

export async function readIndex(env) {
  const raw = await env.YEARBOOK.get('index');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeIndex(env, index) {
  await env.YEARBOOK.put('index', JSON.stringify(index.slice(0, MAX_INDEX)));
}

/** Prefer R2 for image bytes when bound; always keep index/meta in KV. */
export async function putImage(env, id, bytes, meta) {
  if (env.YEARBOOK_R2) {
    await env.YEARBOOK_R2.put(`img/${id}.jpg`, bytes, {
      httpMetadata: { contentType: 'image/jpeg' },
      customMetadata: { name: meta.name || '', createdAt: meta.createdAt },
    });
  } else {
    await env.YEARBOOK.put(`img:${id}`, bytes, {
      httpMetadata: { contentType: 'image/jpeg' },
    });
  }
  await env.YEARBOOK.put(`meta:${id}`, JSON.stringify(meta));
}

export async function getImage(env, id) {
  if (env.YEARBOOK_R2) {
    const obj = await env.YEARBOOK_R2.get(`img/${id}.jpg`);
    if (!obj) return null;
    return { body: obj.body, size: obj.size };
  }
  const val = await env.YEARBOOK.get(`img:${id}`, { type: 'arrayBuffer' });
  if (!val) return null;
  return { body: val, size: val.byteLength };
}

export async function getMeta(env, id) {
  const raw = await env.YEARBOOK.get(`meta:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
