import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const index = await readFile(path.join(projectRoot, 'index.html'), 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(index)) failures.push(message);
}

requirePattern(/<html\s+lang="pt-BR"/i, 'O documento deve declarar lang="pt-BR".');
requirePattern(/class="skip-link"[^>]+href="#mainContent"/i, 'O link para pular ao conteúdo principal está ausente.');
requirePattern(/<main[^>]+id="mainContent"[^>]+tabindex="-1"/i, 'O conteúdo principal deve ser focável pelo link de salto.');
requirePattern(/id="modal"[^>]+role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="modalTitle"/i, 'O modal principal deve possuir semântica acessível.');
requirePattern(/id="confirmModal"[^>]+role="alertdialog"[^>]+aria-modal="true"/i, 'A confirmação deve usar alertdialog modal.');
requirePattern(/id="toastRegion"[^>]+aria-live="polite"/i, 'A região de notificações deve anunciar mensagens.');

if (/\son[a-z]+\s*=/.test(index)) failures.push('Eventos inline impedem uma política de segurança e acessibilidade consistente.');

for (const tag of [...index.matchAll(/<button\b[^>]*>/gi)].map(match => match[0])) {
  if (!/\btype\s*=/.test(tag)) failures.push(`Botão estático sem type: ${tag}`);
}
for (const tag of [...index.matchAll(/<img\b[^>]*>/gi)].map(match => match[0])) {
  if (!/\balt\s*=/.test(tag)) failures.push(`Imagem estática sem alt: ${tag}`);
}

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) result.push(...await walk(fullPath));
    else if (fullPath.endsWith('.js')) result.push(fullPath);
  }
  return result;
}

for (const file of await walk(path.join(projectRoot, 'assets', 'js'))) {
  const source = await readFile(file, 'utf8');
  for (const tag of [...source.matchAll(/<button\b[^>]*>/gi)].map(match => match[0])) {
    if (!/\btype\s*=/.test(tag)) {
      failures.push(`${path.relative(projectRoot, file)} possui botão de template sem type: ${tag}`);
    }
  }
}

if (failures.length) {
  console.error(`Auditoria de acessibilidade reprovada:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('Auditoria estática de acessibilidade aprovada.');
