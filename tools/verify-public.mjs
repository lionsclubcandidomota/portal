import { readFile, access } from 'node:fs/promises';

const json = JSON.parse(await readFile(new URL('../data/dados.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../assets/js/public-app.js', import.meta.url), 'utf8');

const allowed = ['settings','birthdays','events','meetings','notices','leaders'];
const keys = Object.keys(json.data || {}).sort();
if (JSON.stringify(keys) !== JSON.stringify([...allowed].sort())) throw new Error(`Chaves públicas inesperadas: ${keys.join(', ')}`);
for (const forbidden of ['treasury','treasuryAccounts','treasuryCategories','familyGroups','mutualGroups','portalUsers','accessRoles']) {
  if (forbidden in json.data) throw new Error(`Dado interno encontrado: ${forbidden}`);
}
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
