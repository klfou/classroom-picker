import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildWeb, ROOT} from './build.mjs';

const MIME = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};

// Serve only this build's allowlisted files. Never expose the source checkout,
// Electron code, data directories, or files dropped into dist after startup.
export function createPreviewServer(root = ROOT) {
  const files = new Set(buildWeb(root));
  return createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {Allow: 'GET, HEAD'}).end();
      return;
    }
    let relative;
    try {
      relative = decodeURIComponent(request.url.split('?')[0]);
      if (!relative.startsWith('/') || relative.includes('\\') || relative.includes('\0')) throw new Error('Invalid URL');
      relative = relative.slice(1);
      if (relative === '' || relative.endsWith('/')) relative += 'index.html';
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    if (!files.has(relative)) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      const bytes = readFileSync(path.join(root, 'dist', relative));
      response.writeHead(200, {'Content-Type': MIME[path.extname(relative)] || 'application/octet-stream',
        'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'});
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1]))) {
    throw new Error('Usage: npm run serve -- --port 8000');
  }
  const port = args.length ? Number(args[1]) : 8000;
  if (port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535');
  const server = createPreviewServer();
  server.on('error', error => {console.error(error.message); process.exitCode = 1;});
  server.listen(port, '127.0.0.1', () => console.log(`Open http://127.0.0.1:${port} (Ctrl+C to stop).`));
}
