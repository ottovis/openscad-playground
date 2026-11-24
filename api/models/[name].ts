// Named model links: GET/PUT /api/models/<name>. The body is the app's URL fragment (gzip+base64 state).
import { get, put } from '@vercel/blob';

const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
// ponytail: Function request bodies cap at ~4.5MB; switch to client uploads if models outgrow that.
const MAX_BYTES = 4_000_000;

function blobPath(request: Request): string | null {
  const name = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '');
  return NAME.test(name) ? `models/${name.toLowerCase()}.txt` : null;
}

export async function GET(request: Request) {
  const path = blobPath(request);
  if (!path) return new Response('Invalid name', { status: 400 });
  const blob = await get(path, { access: 'private', useCache: false });
  if (!blob || blob.statusCode !== 200) return new Response('Not found', { status: 404 });
  return new Response(blob.stream, { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}

export async function PUT(request: Request) {
  const password = process.env.MODELS_PASSWORD;
  if (!password || request.headers.get('x-models-password') !== password) {
    return new Response('Wrong password', { status: 401 });
  }
  const path = blobPath(request);
  if (!path) return new Response('Invalid name: use letters, digits, - and _ (max 64)', { status: 400 });
  const body = await request.text();
  if (!body || body.length > MAX_BYTES) return new Response('Empty or too large', { status: 413 });
  await put(path, body, { access: 'private', allowOverwrite: true, contentType: 'text/plain' });
  return new Response(null, { status: 204 });
}
