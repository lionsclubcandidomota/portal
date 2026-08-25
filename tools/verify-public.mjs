import { readFile, access } from 'node:fs/promises';

const json = JSON.parse(await readFile(new URL('../data/dados.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../assets/js/public-app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../assets/css/public.css', import.meta.url), 'utf8');
const icons = await readFile(new URL('../assets/icons/ui-icons.svg', import.meta.url), 'utf8');

const allowed = ['settings','birthdays','events','meetings','notices','leaders'];
const keys = Object.keys(json.data || {}).sort();
if (JSON.stringify(keys) !== JSON.stringify([...allowed].sort())) throw new Error(`Chaves públicas inesperadas: ${keys.join(', ')}`);
for (const forbidden of ['treasury','treasuryAccounts','treasuryCategories','familyGroups','mutualGroups','portalUsers','accessRoles']) {
  if (forbidden in json.data) throw new Error(`Dado interno encontrado: ${forbidden}`);
}

const iconIds = new Set([...icons.matchAll(/<symbol\s+id="([^"]+)"/g)].map(match => match[1]));
const referencedIcons = new Set([
  ...[...html.matchAll(/ui-icons\.svg#([A-Za-z0-9_-]+)/g)].map(match => match[1]),
  ...[...js.matchAll(/icon\(['"]([^'"]+)['"]\)/g)].map(match => match[1])
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
await Promise.all([
  '../public/logo.png','../public/favicon.png','../assets/icons/ui-icons.svg','../assets/templates/birthday-template.webp'
].map(path => access(new URL(path, import.meta.url))));
console.log(`Portal público validado: ${json.data.birthdays.length} aniversariantes, ${json.data.leaders.length} dirigentes, ${json.data.events.length + json.data.meetings.length} compromissos e ${json.data.notices.length} avisos.`);
