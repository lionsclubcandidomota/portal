import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { watch as watchFiles } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATUS_PATH = '/__portal_homologation/status';
const EVENTS_PATH = '/__portal_homologation/events';

const MIME_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp']
]);

function isIgnoredWatchPath(filename = '') {
  const normalized = String(filename).replaceAll('\\', '/');
  return !normalized
    || normalized.includes('/.git/')
    || normalized.startsWith('.git/')
    || normalized.includes('/node_modules/')
    || normalized.startsWith('node_modules/')
    || normalized.endsWith('release-manifest.json')
    || normalized.endsWith('.zip');
}

function safeFilePath(root, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (relative.split(/[\\/]+/).some(segment => segment === '..' || segment.startsWith('.'))) return null;

  const absolute = path.resolve(root, relative);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  return absolute === path.resolve(root) || absolute.startsWith(rootPrefix) ? absolute : null;
}

function applyBaseHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
}

async function resolveStaticFile(root, requestPath) {
  let absolutePath = safeFilePath(root, requestPath);
  if (!absolutePath) return null;

  try {
    const info = await stat(absolutePath);
    if (info.isDirectory()) absolutePath = path.join(absolutePath, 'index.html');
    const fileInfo = await stat(absolutePath);
    return fileInfo.isFile() ? { absolutePath, fileInfo } : null;
  } catch {
    return null;
  }
}

function openBrowser(url) {
  const configuration = process.platform === 'win32'
    ? { command: 'cmd', args: ['/c', 'start', '', url] }
    : process.platform === 'darwin'
      ? { command: 'open', args: [url] }
      : { command: 'xdg-open', args: [url] };

  try {
    const child = spawn(configuration.command, configuration.args, {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } catch {
    // A URL permanece disponível no terminal mesmo quando a abertura automática falha.
  }
}

export async function startHomologationServer({
  root = projectRoot,
  host = '127.0.0.1',
  port = 5500,
  watch = true,
  open = false,
  maxPortAttempts = 10,
  logger = console
} = {}) {
  const resolvedRoot = path.resolve(root);
  const clients = new Set();
  let watcher = null;
  let reloadTimer = null;

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    applyBaseHeaders(response);

    if (requestUrl.pathname === STATUS_PATH) {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ name: 'portal-lions-homologation', liveReload: watch }));
      return;
    }

    if (requestUrl.pathname === EVENTS_PATH) {
      if (!watch) {
        response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Live reload desativado.' }));
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive'
      });
      response.write('retry: 1000\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }

    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Método não permitido.');
      return;
    }

    const staticFile = await resolveStaticFile(resolvedRoot, requestUrl.pathname);
    if (!staticFile) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Arquivo não encontrado.');
      return;
    }

    response.writeHead(200, {
      'Content-Type': MIME_TYPES.get(path.extname(staticFile.absolutePath).toLowerCase()) || 'application/octet-stream',
      'Content-Length': staticFile.fileInfo.size
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(staticFile.absolutePath).pipe(response);
  });

  const listen = targetPort => new Promise((resolve, reject) => {
    const handleError = error => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };
    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(targetPort, host);
  });

  let selectedPort = port;
  let lastError;
  for (let attempt = 0; attempt <= maxPortAttempts; attempt += 1) {
    try {
      await listen(port === 0 ? 0 : port + attempt);
      selectedPort = server.address().port;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (error.code !== 'EADDRINUSE' || port === 0 || attempt === maxPortAttempts) break;
    }
  }
  if (lastError) throw lastError;

  const broadcastReload = () => {
    for (const client of clients) client.write(`event: reload\ndata: ${Date.now()}\n\n`);
  };

  if (watch) {
    watcher = watchFiles(resolvedRoot, { recursive: true }, (_eventType, filename) => {
      if (isIgnoredWatchPath(filename)) return;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(broadcastReload, 140);
    });
  }

  const url = `http://${host}:${selectedPort}/index.html`;
  logger.log(`\nHomologação do Portal Lions disponível em:\n${url}\n`);
  if (selectedPort !== port && port !== 0) {
    logger.warn(`A porta ${port} já estava ocupada. Foi utilizada a porta ${selectedPort}.`);
  }
  logger.log('Pressione Ctrl+C para encerrar.');
  if (open) openBrowser(url);

  return {
    server,
    host,
    port: selectedPort,
    url,
    async close() {
      clearTimeout(reloadTimer);
      watcher?.close();
      for (const client of clients) client.end();
      clients.clear();
      await new Promise(resolve => server.close(resolve));
    }
  };
}

function parseCliArguments(args) {
  const options = { open: args.includes('--open') };
  for (const argument of args) {
    if (argument.startsWith('--port=')) options.port = Number(argument.slice('--port='.length));
    if (argument.startsWith('--host=')) options.host = argument.slice('--host='.length);
    if (argument === '--no-watch') options.watch = false;
  }
  return options;
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
  startHomologationServer(parseCliArguments(process.argv.slice(2))).catch(error => {
    console.error(`Não foi possível iniciar a homologação: ${error.message}`);
    process.exitCode = 1;
  });
}
