// Local dev server: serves the static site and runs the api/ functions the way Vercel does.
// Usage: npm run dev   (reads .env if present, then open http://localhost:3000)

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT) || 3000;

// Minimal .env loader (KEY=value, optional quotes). Real env vars win.
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/\/$/, '');
      const file = join(root, 'api', `${name}.js`);
      if (!/^[a-z0-9-]+$/.test(name) || !existsSync(file)) {
        res.statusCode = 404;
        return res.end('Not found');
      }
      req.query = Object.fromEntries(url.searchParams);
      const { default: handler } = await import(pathToFileURL(file).href);
      return await handler(req, res);
    }

    const pathname = url.pathname === '/' ? '/html/index.html' : decodeURIComponent(url.pathname);
    const file = normalize(join(root, pathname));
    if (!file.startsWith(root) || file.includes(`${root}/api/`) || file.includes('/.env')) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }
    const data = await readFile(file);
    res.setHeader('Content-Type', types[extname(file).toLowerCase()] ?? 'application/octet-stream');
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      res.statusCode = 404;
      return res.end('Not found');
    }
    console.error(err);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Server error');
  }
}).listen(port, () => {
  console.log(`SHOTBYDREAS dev server running at http://localhost:${port}`);
});
