import http from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../docs');
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
async function fingerprint(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const rows = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return fingerprint(path);
    const info = await stat(path);
    return `${path}:${info.mtimeMs}:${info.size}`;
  }));
  return createHash('sha256').update(rows.sort().join('|')).digest('hex');
}
const reload = `<script>(()=>{let revision;setInterval(async()=>{try{const r=await fetch('/__dev_revision',{cache:'no-store'});const next=await r.text();if(revision&&revision!==next){const s=window.logbookReloadState?.();if(s?.busy||s?.dirty)return;location.reload();}revision=next;}catch{}},1000);})();</script>`;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/__dev_revision') {
      res.setHeader('Content-Type', 'text/plain');
      return res.end(await fingerprint());
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/gunsugye') { res.writeHead(302, { Location: '/gunsugye/' }); return res.end(); }
    if (pathname.startsWith('/gunsugye/')) pathname = pathname.slice('/gunsugye'.length);
    const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
    let body = await readFile(path);
    if (extname(path) === '.html') body = Buffer.from(body.toString('utf8').replace('</body>', reload + '</body>'));
    res.setHeader('Content-Type', (types[extname(path)] || 'application/octet-stream') + (['.html', '.js', '.css', '.json', '.svg'].includes(extname(path)) ? '; charset=utf-8' : ''));
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/gunsugye/ (save to reload)`));
