// Servidor local que imita a Vercel: sirve public/ y ejecuta api/*.js. Uso: npm run dev
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

try {
  process.loadEnvFile('.env.local');
} catch {
  console.warn('Sin .env.local: la IA usará plantillas.');
}

const PUBLICO = resolve('public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const PUERTO = Number(process.env.PORT ?? 3000);

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        const nombre = url.pathname.slice(5).replace(/[^a-z-]/g, '');
        const mod = await import(`./api/${nombre}.js`).catch(() => null);
        const fn = mod?.[req.method];
        if (!fn) return res.writeHead(404).end();
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const r = await fn(new Request(url, { method: req.method, headers: { 'content-type': req.headers['content-type'] ?? '' }, body }));
        res.writeHead(r.status, Object.fromEntries(r.headers));
        return res.end(Buffer.from(await r.arrayBuffer()));
      }
      const ruta = resolve(join(PUBLICO, normalize(url.pathname === '/' ? '/index.html' : url.pathname)));
      if (!ruta.startsWith(PUBLICO)) return res.writeHead(403).end();
      const archivo = await readFile(ruta);
      res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream' });
      res.end(archivo);
    } catch (e) {
      if (e.code === 'ENOENT') return res.writeHead(404).end();
      console.error(e);
      res.writeHead(500).end();
    }
  })
  .listen(PUERTO, () => console.log(`Fixazo en http://localhost:${PUERTO}`));
