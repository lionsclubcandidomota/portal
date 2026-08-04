import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findSensitivePortalFields } from '../assets/js/core/portal-security.js';
import { hasPrivatePortalData } from '../assets/js/core/portal-data-boundary.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

async function walk(directory, extension) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) result.push(...await walk(fullPath, extension));
    else if (!extension || fullPath.endsWith(extension)) result.push(fullPath);
  }
  return result;
}

for (const relativePath of ['data/dados.json', 'data/modelo.json']) {
  const payload = JSON.parse(await readFile(path.join(projectRoot, relativePath), 'utf8'));
  const findings = findSensitivePortalFields(payload);
  if (findings.length) {
    failures.push(`${relativePath}: campos sensíveis encontrados em ${findings.join(', ')}.`);
  }
  if (relativePath === 'data/dados.json' && hasPrivatePortalData(payload.data || payload)) {
    failures.push('data/dados.json: o arquivo público contém coleções ou configurações privadas.');
  }
}

const index = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
const requiredPolicies = [
  ['Content-Security-Policy', /http-equiv="Content-Security-Policy"/i],
  ['Permissions-Policy', /http-equiv="Permissions-Policy"/i],
  ['Referrer Policy', /name="referrer"\s+content="no-referrer"/i]
];
for (const [label, pattern] of requiredPolicies) {
  if (!pattern.test(index)) failures.push(`index.html: política ausente — ${label}.`);
}
if (!/object-src 'none'/.test(index)) failures.push("index.html: CSP deve bloquear object-src.");
if (!/connect-src[^\"]*https:\/\/api\.github\.com/.test(index)) {
  failures.push('index.html: CSP deve permitir somente a API necessária do GitHub nas conexões externas.');
}
if (!/script-src 'self';/.test(index)) {
  failures.push("index.html: CSP deve permitir somente scripts externos da própria origem.");
}
if (/script-src[^;"]*'unsafe-inline'/.test(index)) {
  failures.push('index.html: CSP não pode liberar scripts inline genéricos.');
}
if (/\bws:\/\/|\bwss:\/\//.test(index)) {
  failures.push('index.html: CSP não deve liberar WebSocket externo ou injetado por extensões.');
}

const applicationFiles = await walk(path.join(projectRoot, 'assets', 'js'), '.js');
for (const file of applicationFiles) {
  const source = await readFile(file, 'utf8');
  const relative = path.relative(projectRoot, file);
  if (/(?:localStorage|sessionStorage)\.setItem\s*\([^)]*(?:token|password|senha|secret)/is.test(source)) {
    failures.push(`${relative}: possível persistência de credencial no armazenamento do navegador.`);
  }
  if (/JSON\.stringify\s*\(\s*(?:context\.)?model\s*\)/.test(source)) {
    failures.push(`${relative}: o modelo completo do runtime não pode ser serializado.`);
  }
}

if (failures.length) {
  console.error(`Falhas na auditoria de segurança:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`Auditoria de segurança aprovada: 2 arquivos de dados e ${applicationFiles.length} módulos verificados.`);
