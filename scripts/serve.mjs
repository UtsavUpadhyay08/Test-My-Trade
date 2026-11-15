// Serves dist/ on http://localhost:5173 (or $PORT on Render) with the site's security headers,
// the xAI relay, anonymous usage counts (POST /api/e) and the private admin page (/admin).
// No dependencies: run with `node scripts/serve.mjs`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStats } from './stats.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const port = Number(process.env.PORT) || 5173;
const XAI_BASE = process.env.XAI_BASE || 'https://api.x.ai/v1';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.anthropic.com https://api.x.ai; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store'
};
const stats = createStats({ file: join(root, '.data', 'stats.json') });
await stats.load();
stats.start();

const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }); res.end(JSON.stringify(obj)); };
async function body(req, max) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) throw new Error('too large'); chunks.push(c); }
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }

  // Anonymous usage counts sent by the app. Only known event names and values are counted.
  if (url.pathname === '/api/e') {
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    try { stats.record(JSON.parse((await body(req, 2048)).toString() || '{}'), req); } catch { /* ignore bad events */ }
    res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end(); return;
  }
  // Admin data, behind ADMIN_TOKEN.
  if (url.pathname === '/api/admin/stats') {
    const a = stats.checkAdmin(req);
    if (!a.ok) return json(res, a.status, { error: a.error });
    return json(res, 200, stats.snapshot());
  }

  // Relay for xAI (Grok): used only when the browser is refused a direct call. The key is passed through, never stored or logged.
  if (url.pathname.startsWith('/relay/xai/')) {
    const path = url.pathname.slice('/relay/xai/'.length);
    if (path !== 'models' && path !== 'chat/completions') { res.writeHead(404); res.end('Not found'); return; }
    try {
      const b = req.method === 'POST' ? await body(req, 200000) : undefined;
      const up = await fetch(XAI_BASE + '/' + path, { method: req.method, headers: { authorization: req.headers.authorization || '', 'content-type': 'application/json' }, body: b });
      res.writeHead(up.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(Buffer.from(await up.arrayBuffer()));
    } catch (err) {
      json(res, 502, { error: 'This server could not reach xAI: ' + (err.cause && err.cause.code ? err.cause.code : err.message) });
    }
    return;
  }

  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (path === 'admin' || path === 'admin/' || path === 'admin\\') path = 'admin.html';
  const file = join(dist, path === '' ? 'index.html' : path);
  if (!file.startsWith(dist) || /(^|[/\\])(_headers|\.)/.test(path)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const content = await readFile(file);
    res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] || 'application/octet-stream', ...(path.startsWith('admin') ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}) });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});
server.listen(port, '0.0.0.0', () => console.log('Test My Trade is running at http://localhost:' + port + '  (Ctrl+C to stop)\nStats are saved to ' + (stats.store === 'upstash' ? 'Upstash.' : 'a local file (.data/stats.json).') + (process.env.ADMIN_TOKEN ? ' Admin page: http://localhost:' + port + '/admin' : ' Admin page is off: set ADMIN_TOKEN to turn it on.')));

// Save the counts before the process stops (Render sends SIGTERM when the free service goes to sleep).
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { await stats.stop(); process.exit(0); });
