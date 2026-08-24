/**
 * GET  /api/yearbook  — list recent public yearbook entries (newest first)
 * POST /api/yearbook  — opt-in upload of a web-size retro JPEG only
 * OPTIONS             — CORS preflight
 */
import {
  MAX_BYTES,
  corsHeaders,
  json,
  isJpeg,
  sanitizeName,
  clientIp,
  checkRateLimit,
  readIndex,
  writeIndex,
  putImage,
  newId,
} from '../_shared/yearbook.js';

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request.headers.get('Origin')),
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const headers = corsHeaders(request.headers.get('Origin'));

  if (!env.YEARBOOK) {
    return json({ items: [], error: 'Yearbook storage is not configured' }, 503, headers);
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '60', 10) || 60));
  const index = await readIndex(env);
  const slice = index.slice(0, limit);

  const items = [];
  for (const entry of slice) {
    const id = typeof entry === 'string' ? entry : entry.id;
    if (!id) continue;
    let meta = typeof entry === 'object' ? entry : null;
    if (!meta || !meta.createdAt) {
      const stored = await env.YEARBOOK.get(`meta:${id}`);
      if (stored) {
        try { meta = JSON.parse(stored); } catch { meta = { id }; }
      } else {
        meta = { id };
      }
    }
    items.push({
      id,
      url: `/api/yearbook/${id}`,
      name: meta.name || '',
      createdAt: meta.createdAt || null,
    });
  }

  return json({ items }, 200, {
    ...headers,
    'Cache-Control': 'public, max-age=30',
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const headers = corsHeaders(request.headers.get('Origin'));

  if (!env.YEARBOOK) {
    return json({ error: 'Yearbook storage is not configured. Bind YEARBOOK (KV) or enable R2.' }, 503, headers);
  }

  const rate = await checkRateLimit(env, clientIp(request));
  if (!rate.ok) {
    return json({ error: rate.error }, 429, headers);
  }

  let bytes;
  let name = '';

  const contentType = request.headers.get('Content-Type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('photo') || form.get('image') || form.get('file');
      name = sanitizeName(form.get('name'));
      if (!file || typeof file === 'string') {
        return json({ error: 'Missing JPEG field (photo)' }, 400, headers);
      }
      const buf = await file.arrayBuffer();
      bytes = new Uint8Array(buf);
      const ft = (file.type || '').toLowerCase();
      if (ft && ft !== 'image/jpeg' && ft !== 'image/jpg') {
        return json({ error: 'Only image/jpeg is accepted' }, 400, headers);
      }
    } else if (contentType.includes('image/jpeg') || contentType.includes('application/octet-stream')) {
      name = sanitizeName(request.headers.get('X-Yearbook-Name'));
      bytes = new Uint8Array(await request.arrayBuffer());
    } else {
      return json({ error: 'Send multipart/form-data with photo=, or raw image/jpeg' }, 415, headers);
    }
  } catch (e) {
    return json({ error: 'Could not read upload' }, 400, headers);
  }

  if (!bytes || bytes.byteLength === 0) {
    return json({ error: 'Empty upload' }, 400, headers);
  }
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: `Image too large (max ${MAX_BYTES} bytes)` }, 413, headers);
  }
  if (!isJpeg(bytes)) {
    return json({ error: 'Not a valid JPEG' }, 400, headers);
  }

  const id = newId();
  const createdAt = new Date().toISOString();
  const meta = { id, name, createdAt, bytes: bytes.byteLength };

  await putImage(env, id, bytes, meta);

  const index = await readIndex(env);
  index.unshift({ id, name, createdAt });
  await writeIndex(env, index);

  return json({ id, url: `/api/yearbook/${id}`, name, createdAt }, 201, headers);
}
