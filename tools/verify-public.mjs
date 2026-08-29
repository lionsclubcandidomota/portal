import { readFile, access, readdir } from 'node:fs/promises';
import { extname } from 'node:path';

const root = new URL('../', import.meta.url);
const json = JSON.parse(await readFile(new URL('data/dados.json', root), 'utf8'));
const html = await readFile(new URL('index.html', root), 'utf8');
const icons = await readFile(new URL('assets/icons/ui-icons.svg', root), 'utf8');

async function collectTextFiles(relativeDir, extension) {
  const dirUrl = new URL(relativeDir, root);
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const relative = `${relativeDir}${entry.name}`;
    if (entry.isDirectory()) {
      chunks.push(...await collectTextFiles(`${relative}/`, extension));
    } else if (extname(entry.name) === extension) {
      chunks.push({ relative, text: await readFile(new URL(relative, root), 'utf8') });
    }
  }
  return chunks;
}

const jsFiles = await collectTextFiles('assets/js/', '.js');
const cssFiles = await collectTextFiles('assets/css/', '.css');
const js = jsFiles.map(file => file.text).join('\n');
const css = cssFiles.map(file => file.text).join('\n');

const allowed = ['settings','birthdays','events','meetings','notices','leaders'];
const keys = Object.keys(json.data || {}).sort();
if (JSON.stringify(keys) !== JSON.stringify([...allowed].sort())) throw new Error(`Chaves públicas inesperadas: ${keys.join(', ')}`);
for (const forbidden of ['treasury','treasuryAccounts','treasuryCategories','familyGroups','mutualGroups','portalUsers','accessRoles']) {
  if (forbidden in json.data) throw new Error(`Dado interno encontrado: ${forbidden}`);
}

const iconIds = new Set([...icons.matchAll(/<symbol\s+id="([^"]+)"/g)].map(match => match[1]));
const referencedIcons = new Set([
  ...[...html.matchAll(/ui-icons\.svg#([A-Za-z0-9_-]+)/g)].map(match => match[1]),
  ...[...js.matchAll(/icon\(['"]([^'"]+)['"]/g)].map(match => match[1])
]);
for (const iconId of referencedIcons) {
  if (!iconIds.has(iconId)) throw new Error(`Ícone público ausente no sprite: ${iconId}`);
}
if (!/\.ui-icon\{[^}]*fill:none;[^}]*stroke:currentColor;[^}]*stroke-width:/s.test(css)) {
  throw new Error('Os ícones públicos precisam ser renderizados por traço (stroke), não por fill.');
}

if (!/function birthdayRelativeDays\(/.test(js) || !/if \(aUpcoming !== bUpcoming\) return aUpcoming \? -1 : 1;/.test(js) || !/return bDays - aDays/.test(js)) {
  throw new Error('A ordenação pública de aniversários deve priorizar próximos e depois os já ocorridos, do mais recente ao mais antigo.');
}
if (!/birthday-status\.past\{/.test(css)) throw new Error('O estado visual de aniversário já ocorrido está ausente.');

for (const person of json.data.birthdays || []) {
  if ('memberNumber' in person || 'birthDate' in person || 'status' in person) throw new Error(`Campo privado em aniversariante: ${person.name}`);
  if (!/^\d{2}-\d{2}$/.test(person.birthday || '')) throw new Error(`Aniversário público inválido: ${person.name}`);
}
if (/Área administrativa|data-view="treasury"|id="adminAccessNav"|login/i.test(html)) throw new Error('Acesso interno ainda aparece no HTML público.');
if (/github-admin|github-config|lazy-treasury|access-management|portal-runtime/i.test(js)) throw new Error('Dependência interna ainda aparece no JavaScript público.');

let importCount = 0;
for (const file of jsFiles) {
  for (const match of file.text.matchAll(/from\s+['"](\.\.?\/[^'"]+\.js)['"]/g)) {
    importCount += 1;
    await access(new URL(match[1], new URL(file.relative, root)));
  }
}
if (!importCount) throw new Error('A refatoração modular do JavaScript não foi detectada.');
if (jsFiles.find(file => file.relative.endsWith('public-app.js'))?.text.split('\n').length > 150) {
  throw new Error('O entrypoint público voltou a concentrar lógica demais; mantenha as views e regras nos módulos.');
}
if (cssFiles.length < 5) throw new Error('A organização modular do CSS foi perdida.');

await Promise.all([
  'public/logo.png','public/favicon.png','assets/icons/ui-icons.svg','assets/templates/birthday-template.webp',
  'assets/css/base.css','assets/css/pages.css','assets/css/responsive.css','assets/css/refinements.css',
  'assets/js/modules/core.js','assets/js/modules/model.js','assets/js/modules/shell.js'
].map(path => access(new URL(path, root))));

console.log(`Portal público validado: ${json.data.birthdays.length} aniversariantes, ${json.data.leaders.length} dirigentes, ${json.data.events.length + json.data.meetings.length} compromissos e ${json.data.notices.length} avisos. Estrutura: ${jsFiles.length} módulos JS e ${cssFiles.length} folhas CSS.`);
