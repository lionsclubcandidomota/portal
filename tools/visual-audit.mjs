import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { startHomologationServer } from './homologation-server.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'artifacts', 'visual-audit');
const required = process.argv.includes('--required');
const commandTimeout = required ? 20_000 : 4_000;
const conditionTimeout = required ? 15_000 : 2_000;
const viewports = [
  { name: 'mobile-360', width: 360, height: 800, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'notebook-1024', width: 1024, height: 768, mobile: false },
  { name: 'desktop-1366', width: 1366, height: 900, mobile: false }
];
const visualViews = [
  { id: 'dashboard', title: 'Início' },
  { id: 'agenda', title: 'Agenda' },
  { id: 'birthdays', title: 'Aniversariantes' },
  { id: 'leaders', title: 'Dirigentes' },
  { id: 'notices', title: 'Avisos' },
  { id: 'admin', title: 'Área administrativa' }
];

async function executableExists(candidate) {
  if (!candidate) return false;
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Chromium', 'Application', 'chrome.exe')
  ];
  for (const candidate of candidates) {
    if (await executableExists(candidate)) return candidate;
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForJson(url, timeout = required ? 10_000 : 4_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw lastError || new Error(`Tempo esgotado ao consultar ${url}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tempo esgotado ao conectar ao navegador.')), required ? 8_000 : 4_000);
      this.socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', event => {
        clearTimeout(timer);
        reject(event.error || new Error('Falha ao conectar ao navegador.'));
      }, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      const callbacks = this.listeners.get(message.method) || [];
      callbacks.splice(0).forEach(callback => callback(message.params || {}));
    });
  }

  send(method, params = {}, timeout = commandTimeout) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Tempo esgotado ao executar ${method}.`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method, timeout = conditionTimeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Tempo esgotado aguardando ${method}.`)), timeout);
      const callbacks = this.listeners.get(method) || [];
      callbacks.push(params => {
        clearTimeout(timer);
        resolve(params);
      });
      this.listeners.set(method, callbacks);
    });
  }

  close() {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Navegador encerrado antes da resposta ${id}.`));
    }
    this.pending.clear();
    this.socket?.close();
  }
}

async function evaluate(client, expression, { awaitPromise = true, returnByValue = true } = {}) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue,
    userGesture: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Falha ao avaliar a página.');
  return result.result?.value;
}

async function waitForCondition(client, expression, timeout = conditionTimeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(client, expression)) return;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Condição visual não foi atendida: ${expression}`);
}

const layoutExpression = `(() => {
  const visible = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const allowsHorizontalScroll = element => {
    let current = element.parentElement;
    while (current && current !== document.body) {
      const overflow = getComputedStyle(current).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
      current = current.parentElement;
    }
    return false;
  };
  const viewportWidth = document.documentElement.clientWidth;
  const root = document.getElementById('viewRoot');
  const rootRect = root?.getBoundingClientRect() || { left: 0, right: viewportWidth };
  const overflowing = [...(root?.querySelectorAll('*') || [])]
    .filter(visible)
    .filter(element => !allowsHorizontalScroll(element))
    .map(element => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.right > rootRect.right + 2 || rect.left < rootRect.left - 2)
    .slice(0, 12)
    .map(({ element, rect }) => ({
      selector: element.id ? '#' + element.id : element.className ? '.' + String(element.className).trim().replace(/\s+/g, '.') : element.tagName,
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width)
    }));
  const appointments = [...document.querySelectorAll('.appointment-home-item')].filter(visible);
  const appointmentOverflow = appointments.filter(item => {
    const parent = item.closest('.dashboard-agenda-card') || item.parentElement;
    if (!parent) return false;
    const itemRect = item.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return itemRect.left < parentRect.left - 2 || itemRect.right > parentRect.right + 2;
  }).length;
  const leaderCards = [...document.querySelectorAll('.leader-card')].filter(visible);
  const leaderCardOverflow = leaderCards.filter(item => {
    const parent = item.closest('.leaders-grid') || item.parentElement;
    if (!parent) return false;
    const itemRect = item.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return itemRect.left < parentRect.left - 2 || itemRect.right > parentRect.right + 2;
  }).length;
  const pageTitle = document.getElementById('pageTitle');
  const pageTitleRect = pageTitle?.getBoundingClientRect();
  const topbarClipped = Boolean(pageTitleRect && (pageTitleRect.left < -2 || pageTitleRect.right > viewportWidth + 2));
  const visibleBottomNav = [...document.querySelectorAll('.mobile-bottom-nav button')].filter(visible);
  const bottomNavTooNarrow = visibleBottomNav.some(button => button.getBoundingClientRect().width < 64);
  const sidebarLabelsClipped = [...document.querySelectorAll('.sidebar .nav-label')]
    .filter(visible)
    .filter(label => label.scrollWidth > label.clientWidth + 2)
    .map(label => label.textContent.trim());
  return {
    viewportWidth,
    documentWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 2,
    contentOverflow: Boolean(root && root.scrollWidth > root.clientWidth + 2),
    overflowing,
    appointmentOverflow,
    appointmentCount: appointments.length,
    leaderCardOverflow,
    leaderCardCount: leaderCards.length,
    pageTitle: pageTitle?.textContent || '',
    topbarClipped,
    bottomNavTooNarrow,
    sidebarLabelsClipped,
    loading: Boolean(document.querySelector('.feature-loading'))
  };
})()`;

async function capture(client, filePath) {
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  await writeFile(filePath, Buffer.from(data, 'base64'));
}

async function auditViewport(client, portalUrl, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height
  });
  const loadEvent = client.waitFor('Page.loadEventFired');
  await client.send('Page.navigate', { url: portalUrl });
  await loadEvent;
  try {
    await waitForCondition(client, `!document.body.classList.contains('app-loading') && document.querySelector('#viewRoot')?.children.length > 0`);
  } catch (error) {
    const diagnostics = await evaluate(client, `({
      href: location.href,
      readyState: document.readyState,
      bodyClass: document.body?.className || '',
      title: document.title,
      root: document.querySelector('#viewRoot')?.innerHTML?.slice(0, 600) || '',
      htmlLength: document.documentElement?.outerHTML?.length || 0
    })`);
    throw new Error(`${error.message}\nDiagnóstico: ${JSON.stringify(diagnostics)}`);
  }
  await new Promise(resolve => setTimeout(resolve, 250));

  const views = {};
  for (const view of visualViews) {
    if (view.id !== 'dashboard') {
      await evaluate(client, `document.querySelector('[data-view="${view.id}"]')?.click(); true`);
      await waitForCondition(client, `document.getElementById('pageTitle')?.textContent === ${JSON.stringify(view.title)} && !document.querySelector('.feature-loading')`);
      await new Promise(resolve => setTimeout(resolve, 180));
    }
    views[view.id] = await evaluate(client, layoutExpression);
    await capture(client, path.join(outputRoot, `${viewport.name}-${view.id}.png`));
  }

  return { viewport, views };
}

const browserPath = await findBrowser();
if (!browserPath) {
  const message = 'Auditoria visual ignorada: Chrome ou Chromium não foi encontrado.';
  if (required) {
    console.error(message);
    process.exit(1);
  }
  console.warn(message);
  process.exit(0);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
const server = await startHomologationServer({ port: 0, watch: false, logger: { log() {}, warn() {} } });
await fetch(server.url).then(response => {
  if (!response.ok) throw new Error(`Servidor visual respondeu com HTTP ${response.status}.`);
});
const debuggingPort = await freePort();
const userDataDir = path.join(os.tmpdir(), `portal-visual-${process.pid}-${Date.now()}`);
const browser = spawn(browserPath, [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--proxy-server=direct://',
  '--proxy-bypass-list=*',
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank'
], { stdio: 'ignore' });

let client;
try {
  const targets = await waitForJson(`http://127.0.0.1:${debuggingPort}/json/list`);
  const target = targets.find(item => item.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('Nenhuma página de depuração foi encontrada.');
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  const results = [];
  for (const viewport of viewports) results.push(await auditViewport(client, server.url, viewport));

  const failures = [];
  for (const result of results) {
    for (const view of visualViews) {
      const report = result.views[view.id];
      const label = `${result.viewport.name} · ${view.title}`;
      if (report.horizontalOverflow) failures.push(`${label}: documento ${report.documentWidth}px em viewport ${report.viewportWidth}px`);
      if (report.contentOverflow) failures.push(`${label}: conteúdo principal possui rolagem horizontal inesperada`);
      if (report.overflowing.length) failures.push(`${label}: ${report.overflowing.length} elemento(s) ultrapassam o conteúdo principal`);
      if (report.appointmentOverflow) failures.push(`${label}: ${report.appointmentOverflow} compromisso(s) ultrapassam o card`);
      if (report.leaderCardOverflow) failures.push(`${label}: ${report.leaderCardOverflow} card(s) de dirigente ultrapassam a grade`);
      if (report.topbarClipped) failures.push(`${label}: título do topo ultrapassa a viewport`);
      if (report.bottomNavTooNarrow) failures.push(`${label}: item da navegação móvel ficou estreito demais`);
      if (report.sidebarLabelsClipped.length) failures.push(`${label}: rótulos laterais cortados (${report.sidebarLabelsClipped.join(', ')})`);
      if (report.loading) failures.push(`${label}: estado de carregamento não terminou`);
    }
  }

  await writeFile(path.join(outputRoot, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results, failures }, null, 2));
  if (failures.length) {
    console.error(`Auditoria visual encontrou problemas:\n${failures.map(item => `- ${item}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Auditoria visual aprovada em ${viewports.length} resoluções. Capturas: ${path.relative(projectRoot, outputRoot)}`);
  }
} catch (error) {
  if (required) throw error;
  console.warn(`Auditoria visual ignorada: o navegador encontrado não conseguiu concluir a execução (${error.message.split('\n')[0]}).`);
} finally {
  client?.close();
  browser.kill('SIGTERM');
  await server.close();
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
