import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsRoot = path.join(projectRoot, 'artifacts', 'homologation');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const index = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
const visualAudit = await readFile(path.join(projectRoot, 'tools', 'visual-audit.mjs'), 'utf8');
const payload = JSON.parse(await readFile(path.join(projectRoot, 'data', 'dados.json'), 'utf8'));

const schema = await import(`${pathToFileURL(path.join(projectRoot, 'assets/js/core/portal-schema.js')).href}?audit=${Date.now()}`);
const leadership = await import(`${pathToFileURL(path.join(projectRoot, 'assets/js/core/portal-leadership.js')).href}?audit=${Date.now()}`);
const leaders = await import(`${pathToFileURL(path.join(projectRoot, 'assets/js/modules/leaders.js')).href}?audit=${Date.now()}`);

const migrated = schema.migratePortalPayload(payload);
const state = migrated.state;
const issues = [];
const warnings = [];

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

if (payload.schemaVersion !== schema.CURRENT_SCHEMA_VERSION) {
  issues.push(`data/dados.json usa schema ${payload.schemaVersion}; esperado ${schema.CURRENT_SCHEMA_VERSION}.`);
}
if (migrated.migrated) issues.push('data/dados.json ainda depende de migração.');
const stateValidation = schema.validatePortalState(state);
if (!stateValidation.valid) issues.push(...stateValidation.errors.map(error => `Estado inválido: ${error}`));

const members = new Map((state.birthdays || []).map(member => [member.id, member]));
const roles = new Map((state.accessRoles || []).map(role => [role.id, role]));
const assignments = Array.isArray(state.leadershipAssignments) ? state.leadershipAssignments : [];
const users = Array.isArray(state.portalUsers) ? state.portalUsers : [];

for (const assignment of assignments) {
  if (!members.has(assignment.memberId)) issues.push(`Designação ${assignment.id} referencia associado inexistente.`);
  if (!roles.has(assignment.roleId)) issues.push(`Designação ${assignment.id} referencia cargo inexistente.`);
  if (!leadership.assignmentDateRangeIsValid(assignment)) issues.push(`Designação ${assignment.id} possui período inválido.`);
}
for (const user of users) {
  if (!members.has(user.memberId)) issues.push(`Usuário ${user.id} referencia associado inexistente.`);
  if (!roles.has(user.roleId)) issues.push(`Usuário ${user.id} referencia cargo inexistente.`);
}
for (const username of duplicateValues(users.map(user => String(user.username || '').trim().toLocaleLowerCase('pt-BR')))) {
  issues.push(`Nome de usuário duplicado: ${username}.`);
}

const activeAssignments = assignments.filter(item => item.active !== false);
for (let firstIndex = 0; firstIndex < activeAssignments.length; firstIndex += 1) {
  const first = activeAssignments[firstIndex];
  for (let secondIndex = firstIndex + 1; secondIndex < activeAssignments.length; secondIndex += 1) {
    const second = activeAssignments[secondIndex];
    if (first.memberId !== second.memberId) continue;
    if (first.startsOn <= second.endsOn && second.startsOn <= first.endsOn) {
      issues.push(`Designações sobrepostas para ${first.memberId}: ${first.id} e ${second.id}.`);
    }
  }
}

if (!/data-view="leaders"/.test(index)) issues.push('A rota pública Dirigentes não está disponível no menu.');
if (!/id:\s*'leaders'/.test(visualAudit)) issues.push('A auditoria visual não cobre a área pública Dirigentes.');

const publicSummary = leaders.publicLeadershipSummary(state);
if (!publicSummary.count) warnings.push(`Nenhum dirigente está publicado para o AL ${publicSummary.lionYear}.`);

const report = {
  generatedAt: new Date().toISOString(),
  version: packageJson.version,
  schemaVersion: schema.CURRENT_SCHEMA_VERSION,
  counts: {
    members: state.birthdays?.length || 0,
    roles: state.accessRoles?.length || 0,
    users: users.length,
    leadershipAssignments: assignments.length,
    publicLeaders: publicSummary.count
  },
  currentLionYear: publicSummary.lionYear,
  issues,
  warnings
};

await mkdir(artifactsRoot, { recursive: true });
await writeFile(path.join(artifactsRoot, 'integrated-report.json'), `${JSON.stringify(report, null, 2)}\n`);

if (issues.length) {
  console.error(`Homologação integrada encontrou ${issues.length} problema(s):\n${issues.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`Homologação integrada aprovada para o Portal v${packageJson.version}.`);
console.log(`AL vigente: ${publicSummary.lionYear} · dirigentes publicados: ${publicSummary.count}.`);
if (warnings.length) console.warn(warnings.map(item => `Aviso: ${item}`).join('\n'));
console.log(`Relatório: ${path.relative(projectRoot, path.join(artifactsRoot, 'integrated-report.json'))}`);
