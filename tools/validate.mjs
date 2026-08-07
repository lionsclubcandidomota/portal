import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const appVersion = packageJson.version;

async function walk(directory, extension) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) result.push(...await walk(fullPath, extension));
    else if (fullPath.endsWith(extension)) result.push(fullPath);
  }
  return result;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
}

const jsFiles = [
  ...await walk(path.join(projectRoot, 'assets', 'js'), '.js'),
  ...await walk(path.join(projectRoot, 'tools'), '.mjs'),
  ...await walk(path.join(projectRoot, 'tests'), '.mjs')
];

for (const file of jsFiles) {
  run(process.execPath, ['--check', file]);
}
console.log(`JavaScript validado: ${jsFiles.length} arquivos.`);

const missingImports = [];
for (const file of jsFiles.filter(file => file.includes(`${path.sep}assets${path.sep}js${path.sep}`))) {
  const source = await readFile(file, 'utf8');
  const imports = [
    ...source.matchAll(/(?:from\s+|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)
  ].map(match => match[1].split(/[?#]/, 1)[0]);

  for (const importPath of imports) {
    const target = path.resolve(path.dirname(file), importPath);
    try {
      await stat(target);
    } catch {
      missingImports.push(`${path.relative(projectRoot, file)} -> ${importPath}`);
    }
  }
}

if (missingImports.length) {
  console.error(`Imports locais ausentes:\n${missingImports.join('\n')}`);
  process.exit(1);
}
console.log('Grafo de imports locais validado.');

const treasuryFacadePath = path.join(projectRoot, 'assets', 'js', 'modules', 'treasury.js');
const treasuryFacadeSource = await readFile(treasuryFacadePath, 'utf8');
const treasuryModule = await import(`${pathToFileURL(treasuryFacadePath).href}?validate=${Date.now()}`);
const treasuryExports = ['createTreasuryController', 'destroyTreasuryCharts', 'renderTreasury'];
for (const exportName of treasuryExports) {
  if (typeof treasuryModule[exportName] !== 'function') {
    console.error(`Export público ausente na fachada da Tesouraria: ${exportName}.`);
    process.exit(1);
  }
}
if (treasuryFacadeSource.split(/\r?\n/).filter(Boolean).length > 10) {
  console.error('assets/js/modules/treasury.js deve permanecer como uma fachada enxuta.');
  process.exit(1);
}
console.log('Arquitetura modular da Tesouraria validada.');

const treasuryViewPath = path.join(projectRoot, 'assets', 'js', 'modules', 'treasury', 'view.js');
const treasuryViewSource = await readFile(treasuryViewPath, 'utf8');
if (treasuryViewSource.split(/\r?\n/).filter(Boolean).length > 90) {
  console.error('assets/js/modules/treasury/view.js deve permanecer como um orquestrador enxuto.');
  process.exit(1);
}
for (const moduleName of [
  'view-shell.js',
  'view-overview.js',
  'view-memberships.js',
  'view-mutuals.js',
  'view-charts.js'
]) {
  await stat(path.join(projectRoot, 'assets', 'js', 'modules', 'treasury', moduleName));
}
console.log('Bindings e composição visual da Tesouraria permanecem separados.');


const entityFormsPath = path.join(projectRoot, 'assets', 'js', 'modules', 'entity-forms.js');
const entityFormsSource = await readFile(entityFormsPath, 'utf8');
const entityTemplatesPath = path.join(projectRoot, 'assets', 'js', 'modules', 'entity-forms', 'templates.js');
const entityTemplates = await import(`${pathToFileURL(entityTemplatesPath).href}?validate=${Date.now()}`);
if (entityFormsSource.split(/\r?\n/).length > 380) {
  console.error('assets/js/modules/entity-forms.js deve permanecer focado na coordenação dos cadastros.');
  process.exit(1);
}
for (const exportName of ['entityFormHtml', 'normalizeExternalUrl', 'normalizeLocationData', 'setupLocationFields']) {
  if (typeof entityTemplates[exportName] !== 'function') {
    console.error(`Export público ausente nos templates de cadastros: ${exportName}.`);
    process.exit(1);
  }
}
console.log('Templates e coordenação dos cadastros permanecem separados.');

const portalBootstrapPath = path.join(projectRoot, 'assets', 'js', 'modules', 'portal-app.js');
const portalBootstrapSource = await readFile(portalBootstrapPath, 'utf8');
const portalViewRendererPath = path.join(projectRoot, 'assets', 'js', 'modules', 'portal-view-renderer.js');
const portalViewRenderer = await import(`${pathToFileURL(portalViewRendererPath).href}?validate=${Date.now()}`);
if (portalBootstrapSource.split(/\r?\n/).length >= 340) {
  console.error('assets/js/modules/portal-app.js deve permanecer abaixo de 340 linhas.');
  process.exit(1);
}
if (typeof portalViewRenderer.createPortalViewRenderer !== 'function') {
  console.error('Export público ausente no compositor visual do portal.');
  process.exit(1);
}
console.log('Bootstrap e renderização das páginas permanecem separados.');

const compositionDirectory = path.join(projectRoot, 'assets', 'js', 'modules', 'portal-composition');
const compositionContracts = new Map([
  ['treasury-feature.js', 'createTreasuryFeature'],
  ['administration-feature.js', 'createAdministrationFeature'],
  ['publication-feature.js', 'createPublicationFeature'],
  ['navigation-feature.js', 'createNavigationFeature'],
  ['view-dependencies.js', 'createPortalViewRendererOptions']
]);
for (const [fileName, exportName] of compositionContracts) {
  const modulePath = path.join(compositionDirectory, fileName);
  const source = await readFile(modulePath, 'utf8');
  const module = await import(`${pathToFileURL(modulePath).href}?validate=${Date.now()}`);
  if (source.split(/\r?\n/).length >= 140) {
    console.error(`${fileName} deve permanecer abaixo de 140 linhas.`);
    process.exit(1);
  }
  if (typeof module[exportName] !== 'function') {
    console.error(`Export público ausente em ${fileName}: ${exportName}.`);
    process.exit(1);
  }
}
console.log('Features de composição do portal permanecem isoladas e enxutas.');

const treasuryAdminFacadePath = path.join(projectRoot, 'assets', 'js', 'modules', 'treasury-admin.js');
const treasuryAdminFacadeSource = await readFile(treasuryAdminFacadePath, 'utf8');
const treasuryAdminModule = await import(`${pathToFileURL(treasuryAdminFacadePath).href}?validate=${Date.now()}`);
if (typeof treasuryAdminModule.createTreasuryAdminController !== 'function') {
  console.error('Export público ausente na fachada administrativa da Tesouraria.');
  process.exit(1);
}
if (treasuryAdminFacadeSource.split(/\r?\n/).filter(Boolean).length > 40) {
  console.error('assets/js/modules/treasury-admin.js deve permanecer como uma fachada enxuta.');
  process.exit(1);
}

console.log('Arquitetura administrativa modular da Tesouraria validada.');

const adminPanelPath = path.join(projectRoot, 'assets', 'js', 'modules', 'admin-panel.js');
const adminPanelSource = await readFile(adminPanelPath, 'utf8');
if (adminPanelSource.split(/\r?\n/).length > 180) {
  console.error('assets/js/modules/admin-panel.js deve permanecer como um controlador enxuto.');
  process.exit(1);
}

const adminDashboardDomainPath = path.join(projectRoot, 'assets', 'js', 'modules', 'admin-dashboard', 'domain.js');
const adminDashboardViewPath = path.join(projectRoot, 'assets', 'js', 'modules', 'admin-dashboard', 'view.js');
const adminDashboardDomain = await import(`${pathToFileURL(adminDashboardDomainPath).href}?validate=${Date.now()}`);
const adminDashboardView = await import(`${pathToFileURL(adminDashboardViewPath).href}?validate=${Date.now()}`);
for (const exportName of ['createAdminDashboardModel', 'periodBounds', 'resolveEventStatus', 'resolveMeetingStatus', 'summarizeTreasury']) {
  if (typeof adminDashboardDomain[exportName] !== 'function') {
    console.error(`Export público ausente no domínio do dashboard administrativo: ${exportName}.`);
    process.exit(1);
  }
}
for (const exportName of ['adminDashboardHtml', 'adminLoginHtml']) {
  if (typeof adminDashboardView[exportName] !== 'function') {
    console.error(`Export público ausente na view do dashboard administrativo: ${exportName}.`);
    process.exit(1);
  }
}
console.log('Dashboard administrativo modular e testável validado.');

const dialogFocusPath = path.join(projectRoot, 'assets', 'js', 'modules', 'dialog-focus.js');
const dialogFocusModule = await import(`${pathToFileURL(dialogFocusPath).href}?validate=${Date.now()}`);
for (const exportName of ['createDialogFocusManager', 'getFocusableElements']) {
  if (typeof dialogFocusModule[exportName] !== 'function') {
    console.error(`Export público ausente no gerenciador de foco: ${exportName}.`);
    process.exit(1);
  }
}
console.log('Gerenciamento de foco dos diálogos validado.');

const runtimeFacadePath = path.join(projectRoot, 'assets', 'js', 'modules', 'portal-runtime.js');
const runtimeFacadeSource = await readFile(runtimeFacadePath, 'utf8');
const runtimeModule = await import(`${pathToFileURL(runtimeFacadePath).href}?validate=${Date.now()}`);
if (typeof runtimeModule.createPortalRuntimeController !== 'function') {
  console.error('Export público ausente na fachada do runtime do portal.');
  process.exit(1);
}
if (runtimeFacadeSource.split(/\r?\n/).filter(Boolean).length > 10) {
  console.error('assets/js/modules/portal-runtime.js deve permanecer como uma fachada enxuta.');
  process.exit(1);
}

const runtimeModules = [
  'access-profile.js',
  'authorization.js',
  'bootstrap.js',
  'constants.js',
  'context.js',
  'controller.js',
  'domain.js',
  'interface-refresh.js',
  'persistence.js',
  'publication.js',
  'remote-sync.js',
  'session.js',
  'session-guard.js',
  'storage.js'
];
for (const moduleName of runtimeModules) {
  await stat(path.join(projectRoot, 'assets', 'js', 'modules', 'portal-runtime', moduleName));
}
console.log('Arquitetura modular do runtime e da publicação validada.');

const securityPath = path.join(projectRoot, 'assets', 'js', 'core', 'portal-security.js');
const securityModule = await import(`${pathToFileURL(securityPath).href}?validate=${Date.now()}`);
for (const exportName of [
  'findSensitivePortalFields',
  'normalizeGitHubToken',
  'stripSensitivePortalFields'
]) {
  if (typeof securityModule[exportName] !== 'function') {
    console.error(`Export público ausente no módulo de segurança: ${exportName}.`);
    process.exit(1);
  }
}
console.log('Módulo central de segurança e sanitização validado.');

const auditFacadePath = path.join(projectRoot, 'assets', 'js', 'modules', 'audit-log.js');
const auditFacadeSource = await readFile(auditFacadePath, 'utf8');
const auditFacade = await import(`${pathToFileURL(auditFacadePath).href}?validate=${Date.now()}`);
if (typeof auditFacade.createAuditLogController !== 'function') {
  console.error('Export público ausente na fachada do histórico de alterações.');
  process.exit(1);
}
if (auditFacadeSource.split(/\r?\n/).filter(Boolean).length > 10) {
  console.error('assets/js/modules/audit-log.js deve permanecer como uma fachada enxuta.');
  process.exit(1);
}
const auditModules = ['controller.js', 'domain.js', 'storage.js', 'view.js'];
for (const moduleName of auditModules) {
  await stat(path.join(projectRoot, 'assets', 'js', 'modules', 'audit-log', moduleName));
}
const auditDomainPath = path.join(projectRoot, 'assets', 'js', 'modules', 'audit-log', 'domain.js');
const auditDomain = await import(`${pathToFileURL(auditDomainPath).href}?validate=${Date.now()}`);
for (const exportName of ['createAuditEntry', 'groupAuditBatches', 'linkAuditPublication', 'auditLogSummary']) {
  if (typeof auditDomain[exportName] !== 'function') {
    console.error(`Export público ausente no domínio do histórico: ${exportName}.`);
    process.exit(1);
  }
}
console.log('Histórico de alterações modular, sanitizado e testável validado.');

const recoveryFacadePath = path.join(projectRoot, 'assets', 'js', 'modules', 'recovery-center.js');
const recoveryFacadeSource = await readFile(recoveryFacadePath, 'utf8');
const recoveryFacade = await import(`${pathToFileURL(recoveryFacadePath).href}?validate=${Date.now()}`);
if (typeof recoveryFacade.createRecoveryCenterController !== 'function') {
  console.error('Export público ausente na fachada de recuperação.');
  process.exit(1);
}
if (recoveryFacadeSource.split(/\r?\n/).filter(Boolean).length > 10) {
  console.error('assets/js/modules/recovery-center.js deve permanecer como uma fachada enxuta.');
  process.exit(1);
}
const recoveryModules = ['controller.js', 'domain.js', 'storage.js', 'view.js'];
for (const moduleName of recoveryModules) {
  await stat(path.join(projectRoot, 'assets', 'js', 'modules', 'recovery-center', moduleName));
}
const recoveryDomainPath = path.join(projectRoot, 'assets', 'js', 'modules', 'recovery-center', 'domain.js');
const recoveryDomain = await import(`${pathToFileURL(recoveryDomainPath).href}?validate=${Date.now()}`);
for (const exportName of [
  'createRecoverySnapshot',
  'diagnosePortalIntegrity',
  'mergeRecoveryAreas',
  'verifyRecoverySnapshot'
]) {
  if (typeof recoveryDomain[exportName] !== 'function') {
    console.error(`Export público ausente no domínio de recuperação: ${exportName}.`);
    process.exit(1);
  }
}
console.log('Recuperação local modular, assinada e testável validada.');

try {
  await stat(path.join(projectRoot, 'assets', 'css', 'legacy'));
  console.error('A pasta assets/css/legacy não deve existir após a refatoração final.');
  process.exit(1);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
console.log('Camada CSS legacy removida da árvore de fontes.');

const schemaPath = path.join(projectRoot, 'assets', 'js', 'core', 'portal-schema.js');
const schemaModule = await import(`${pathToFileURL(schemaPath).href}?validate=${Date.now()}`);
const schemaExports = [
  'CURRENT_SCHEMA_VERSION',
  'createPortalEnvelope',
  'migratePortalPayload',
  'validatePortalState'
];
for (const exportName of schemaExports) {
  if (!(exportName in schemaModule)) {
    console.error(`Export público ausente no módulo de esquema: ${exportName}.`);
    process.exit(1);
  }
}

for (const relativePath of ['data/modelo.json']) {
  const payload = JSON.parse(await readFile(path.join(projectRoot, relativePath), 'utf8'));
  if (payload.schemaVersion !== schemaModule.CURRENT_SCHEMA_VERSION) {
    console.error(`${relativePath} deve usar schemaVersion ${schemaModule.CURRENT_SCHEMA_VERSION}.`);
    process.exit(1);
  }
  const migrated = schemaModule.migratePortalPayload(payload);
  if (migrated.migrated) {
    console.error(`${relativePath} ainda depende de uma migração legada.`);
    process.exit(1);
  }
  const validation = schemaModule.validatePortalState(migrated.state);
  if (!validation.valid) {
    console.error(`${relativePath} possui estrutura inválida: ${validation.errors.join(' ')}`);
    process.exit(1);
  }
}
console.log(`Esquema de dados v${schemaModule.CURRENT_SCHEMA_VERSION} e modelo de importação validados.`);

for (const relativePath of ['data/dados.json', 'public/members', 'public/treasury']) {
  try {
    await stat(path.join(projectRoot, relativePath));
    console.error(`${relativePath} não deve permanecer no site após a migração integral para D1/R2.`);
    process.exit(1);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
console.log('Dados operacionais e mídias dinâmicas removidos do artefato estático.');

const mediaModulePath = path.join(projectRoot, 'assets', 'js', 'core', 'portal-media.js');
const mediaModule = await import(`${pathToFileURL(mediaModulePath).href}?validate=${Date.now()}`);
for (const exportName of [
  'countEmbeddedPortalMedia',
  'parseEmbeddedImage',
  'preparePortalMediaForPublication',
  'publicMediaPathFromReference'
]) {
  if (typeof mediaModule[exportName] !== 'function') {
    console.error(`Export público ausente no módulo de mídia: ${exportName}.`);
    process.exit(1);
  }
}

let referencedMediaCount = 0;
for (const relativePath of ['data/modelo.json']) {
  const source = await readFile(path.join(projectRoot, relativePath), 'utf8');
  if (source.includes('data:image/')) {
    console.error(`${relativePath} ainda contém imagem Base64 incorporada.`);
    process.exit(1);
  }

  const state = schemaModule.migratePortalPayload(JSON.parse(source)).state;
  const references = [
    state.settings?.logo,
    ...(Array.isArray(state.birthdays) ? state.birthdays.map(item => item?.photo) : [])
  ].filter(Boolean);

  for (const reference of references) {
    const mediaPath = mediaModule.publicMediaPathFromReference(reference);
    if (!mediaPath) continue;
    try {
      await stat(path.join(projectRoot, mediaPath));
      referencedMediaCount += 1;
    } catch {
      console.error(`${relativePath} referencia um arquivo de mídia ausente: ${reference}.`);
      process.exit(1);
    }
  }
}
console.log(`Mídia externa validada: ${referencedMediaCount} referência(s) local(is).`);

const portalAppPath = path.join(projectRoot, 'assets', 'js', 'modules', 'portal-app.js');
const portalAppModule = await import(`${pathToFileURL(portalAppPath).href}?validate=${Date.now()}`);
if (typeof portalAppModule.bootstrapPortal !== 'function') {
  console.error('O módulo principal do portal não exporta bootstrapPortal().');
  process.exit(1);
}
console.log('Composição principal do portal importada com sucesso.');

run(process.execPath, ['tools/build-css.mjs', '--check']);
run(process.execPath, ['--test', 'tests/*.test.mjs']);

const indexPath = path.join(projectRoot, 'index.html');
const index = await readFile(indexPath, 'utf8');
const references = [...index.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)]
  .map(match => match[1]);

const missing = [];
for (const reference of references) {
  const target = path.resolve(projectRoot, reference);
  try {
    await stat(target);
  } catch {
    missing.push(reference);
  }
}

if (missing.length) {
  console.error(`Referências locais ausentes:\n${missing.join('\n')}`);
  process.exit(1);
}

const stylesheetLinks = [...index.matchAll(/<link\s+rel="stylesheet"/g)].length;
if (stylesheetLinks !== 1 || !index.includes(`./assets/css/app.css?v=${appVersion}`)) {
  console.error(`index.html deve carregar somente o bundle assets/css/app.css?v=${appVersion}.`);
  process.exit(1);
}

console.log(`Referências do HTML validadas: ${references.length}.`);
console.log('Validação concluída com sucesso.');
