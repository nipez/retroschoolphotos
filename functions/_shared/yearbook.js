/** Shared yearbook helpers — R2 only (binding YEARBOOK → bucket retro-yearbook). */

export const MAX_BYTES = Math.floor(1.2 * 1024 * 1024); // ~1.2MB
export const MAX_INDEX = 200;
export const RATE_LIMIT = 8; // posts per IP per hour
export const RATE_WINDOW_MS = 3600 * 1000;
export const MAX_NAME_LEN = 40;

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const INDEX_KEY = 'index.json';

export function bucket(env) {
  return env.YEARBOOK || env.RETRO_YEARBOOK || null;
}

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
  return s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[<>]/g, '');
}

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

async function hashIp(ip) {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const u8 = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < 16; i++) hex += u8[i].toString(16).padStart(2, '0');
  return hex;
}

export async function checkRateLimit(env, ip) {
  const r2 = bucket(env);
  if (!r2) return { ok: false, error: 'Yearbook storage is not configured' };

  const key = `rate/${await hashIp(ip)}.json`;
  const now = Date.now();
  let count = 0;
  let resetAt = now + RATE_WINDOW_MS;

  const existing = await r2.get(key);
  if (existing) {
    try {
      const data = JSON.parse(await existing.text());
      if (data.resetAt && data.resetAt > now) {
        count = data.count || 0;
        resetAt = data.resetAt;
      }
    } catch {
      /* start fresh */
    }
  }

  if (count >= RATE_LIMIT) {
    return { ok: false, error: 'Too many yearbook uploads. Try again later.' };
  }

  count += 1;
  await r2.put(key, JSON.stringify({ count, resetAt }), {
    httpMetadata: { contentType: 'application/json' },
  });
  return { ok: true };
}

export async function readIndex(env) {
  const r2 = bucket(env);
  const obj = await r2.get(INDEX_KEY);
  if (!obj) return [];
  try {
    const parsed = JSON.parse(await obj.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeIndex(env, index) {
  const r2 = bucket(env);
  await r2.put(INDEX_KEY, JSON.stringify(index.slice(0, MAX_INDEX)), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function putImage(env, id, bytes, meta) {
  const r2 = bucket(env);
  await r2.put(`img/${id}.jpg`, bytes, {
    httpMetadata: { contentType: 'image/jpeg' },
    customMetadata: {
      name: meta.name || '',
      createdAt: meta.createdAt || '',
      bytes: String(meta.bytes || bytes.byteLength),
    },
  });
}

export async function getImage(env, id) {
  const r2 = bucket(env);
  const obj = await r2.get(`img/${id}.jpg`);
  if (!obj) return null;
  return {
    body: obj.body,
    size: obj.size,
    name: (obj.customMetadata && obj.customMetadata.name) || '',
    createdAt: (obj.customMetadata && obj.customMetadata.createdAt) || null,
  };
}

export async function getMeta(env, id) {
  const r2 = bucket(env);
  const obj = await r2.head(`img/${id}.jpg`);
  if (!obj) return null;
  const cm = obj.customMetadata || {};
  return {
    id,
    name: cm.name || '',
    createdAt: cm.createdAt || null,
    bytes: cm.bytes ? parseInt(cm.bytes, 10) : obj.size,
  };
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
