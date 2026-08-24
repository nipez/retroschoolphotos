/**
 * GET /api/yearbook/:id — public web-size JPEG for an opted-in yearbook entry.
 * Served from private R2 via this Function only (no public r2.dev URL).
 */
import { corsHeaders, bucket, getImage } from '../../_shared/yearbook.js';

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request.headers.get('Origin')),
  });
}

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const headers = corsHeaders(request.headers.get('Origin'));
  const id = (params.id || '').replace(/[^a-zA-Z0-9]/g, '');

  if (!id || id.length < 8) {
    return new Response('Not found', { status: 404, headers });
  }
  if (!bucket(env)) {
    return new Response('Yearbook storage is not configured', { status: 503, headers });
  }

  const img = await getImage(env, id);
  if (!img) {
    return new Response('Not found', { status: 404, headers });
  }

  const out = {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=86400, immutable',
    ...headers,
  };
  if (img.name) {
    out['X-Yearbook-Name'] = img.name;
  }

  return new Response(img.body, { status: 200, headers: out });
}
