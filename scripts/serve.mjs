// Serves dist/ on http://localhost:5173 with the same security headers as production.
// No dependencies: run with `node scripts/serve.mjs`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT) || 5173;
const XAI_BASE = process.env.XAI_BASE || 'https://api.x.ai/v1';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.anthropic.com https://api.x.ai; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store'
};

createServer(async (req, res) => {
  // Relay for xAI (Grok): used only when the browser is refused a direct call. The key is passed through, never stored or logged.
  if (req.url.startsWith('/relay/xai/')) {
    const path = req.url.slice('/relay/xai/'.length).split('?')[0];
    if (path !== 'models' && path !== 'chat/completions') { res.writeHead(404); res.end('Not found'); return; }
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const up = await fetch(XAI_BASE + '/' + path, { method: req.method, headers: { authorization: req.headers.authorization || '', 'content-type': 'application/json' }, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
      res.writeHead(up.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(Buffer.from(await up.arrayBuffer()));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'This computer could not reach xAI: ' + (err.cause && err.cause.code ? err.cause.code : err.message) }));
    }
    return;
  }
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(dist, path === '' ? 'index.html' : path);
  if (!file.startsWith(dist)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log('Test My Trade is running at http://localhost:' + port + '  (Ctrl+C to stop)'));
