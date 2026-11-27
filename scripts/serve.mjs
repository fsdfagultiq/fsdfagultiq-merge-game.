// Tiny zero-dependency static server for local testing: `npm run serve` -> http://localhost:5173
// Serves ./www exactly as Capacitor bundles it into the native apps.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../www', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = normalize(join(ROOT, pathname));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end('Forbidden'); }
    let st;
    try { st = statSync(file); } catch { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    if (st.isDirectory()) { res.writeHead(302, { location: pathname + '/' }); return res.end(); }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
