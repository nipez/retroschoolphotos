/**
 * GET /api/yearbook/:id — public web-size JPEG for an opted-in yearbook entry
 */
import { corsHeaders, getImage, getMeta } from '../../_shared/yearbook.js';

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
  if (!env.YEARBOOK) {
    return new Response('Yearbook storage is not configured', { status: 503, headers });
  }

  const img = await getImage(env, id);
  if (!img) {
    return new Response('Not found', { status: 404, headers });
  }

  const meta = await getMeta(env, id);
  const out = {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=86400, immutable',
    ...headers,
  };
  if (meta?.name) {
    out['X-Yearbook-Name'] = meta.name;
  }

  return new Response(img.body, { status: 200, headers: out });
}
