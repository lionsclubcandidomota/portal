import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

async function walk(directory, extensions = null) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const absolutePath = path.join(directory, entry);
    const info = await stat(absolutePath);
    if (info.isDirectory()) result.push(...await walk(absolutePath, extensions));
    else if (!extensions || extensions.some(extension => absolutePath.endsWith(extension))) result.push(absolutePath);
  }
  return result;
}

const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const indexHtml = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
const dataPath = path.join(projectRoot, 'data', 'dados.json');
const modelPath = path.join(projectRoot, 'data', 'modelo.json');
const dataSource = await readFile(dataPath, 'utf8');
const modelSource = await readFile(modelPath, 'utf8');
const dataEnvelope = JSON.parse(dataSource);
const modelEnvelope = JSON.parse(modelSource);
const schemaPath = path.join(projectRoot, 'assets', 'js', 'core', 'portal-schema.js');
const schemaModule = await import(`${pathToFileURL(schemaPath).href}?release=${Date.now()}`);
const appFiles = await walk(path.join(projectRoot, 'assets', 'js'), ['.js']);
const appSources = await Promise.all(appFiles.map(async file => ({
  file,
  source: await readFile(file, 'utf8')
})));

for (const required of [
  '.gitignore',
  'CHANGELOG.md',
  'REFACTORING.md',
  'RELEASE.md',
  'docs/homologation.md',
  'release-manifest.json',
  'INICIAR-HOMOLOGACAO.bat',
  'FINALIZAR-ATUALIZACAO.bat',
  'tools/create-local-backup.mjs',
  'tools/module-graph-audit.mjs',
  'tools/prepare-release.mjs'
]) {
  try {
    await stat(path.join(projectRoot, required));
  } catch {
    failures.push(`arquivo obrigatório ausente: ${required}`);
  }
}


const gitignore = await readFile(path.join(projectRoot, '.gitignore'), 'utf8');
if (!/^\.portal-backups\/$/m.test(gitignore)) failures.push('.gitignore não protege .portal-backups/');
if (!/^artifacts\/$/m.test(gitignore)) failures.push('.gitignore não protege artifacts/');
if (/^INICIAR-HOMOLOGACAO\.bat$/m.test(gitignore)) failures.push('INICIAR-HOMOLOGACAO.bat não pode permanecer ignorado');

const finalizer = await readFile(path.join(projectRoot, 'FINALIZAR-ATUALIZACAO.bat'), 'utf8');
if (!/call npm run release:prepare/i.test(finalizer)) failures.push('FINALIZAR-ATUALIZACAO.bat não usa o pipeline oficial release:prepare');
if (packageJson.scripts?.['release:prepare'] !== 'node tools/prepare-release.mjs') {
  failures.push('release:prepare deve usar tools/prepare-release.mjs');
}
const prepareRelease = await readFile(path.join(projectRoot, 'tools', 'prepare-release.mjs'), 'utf8');
if (prepareRelease.indexOf('tools/create-local-backup.mjs') > prepareRelease.indexOf('tools/migrate-official-data.mjs')) {
  failures.push('prepare-release deve criar backup antes da migração dos dados');
}
if (!String(packageJson.scripts?.quality || '').includes('npm run audit:modules')) {
  failures.push('o portão quality não executa audit:modules');
}

for (const documentPath of ['CHANGELOG.md', 'RELEASE.md', 'docs/homologation.md']) {
  try {
    const source = await readFile(path.join(projectRoot, documentPath), 'utf8');
    if (!source.includes(packageJson.version)) failures.push(`${documentPath} não menciona a versão ${packageJson.version}`);
  } catch {
    // A ausência já foi registrada acima.
  }
}

for (const [relativePath, envelope, source] of [
  ['data/dados.json', dataEnvelope, dataSource],
  ['data/modelo.json', modelEnvelope, modelSource]
]) {
  if (envelope.schemaVersion !== schemaModule.CURRENT_SCHEMA_VERSION) {
    failures.push(`${relativePath} usa esquema v${envelope.schemaVersion}; esperado v${schemaModule.CURRENT_SCHEMA_VERSION}`);
  }
  if (/data:image\//i.test(source)) failures.push(`${relativePath} contém imagem Base64 incorporada`);
}
if (Buffer.byteLength(dataSource) > 100_000) failures.push('data/dados.json voltou a ultrapassar 100 KB');

const runtimeSources = `${indexHtml}\n${appSources.map(item => item.source).join('\n')}`;
for (const forbidden of ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com']) {
  if (runtimeSources.includes(forbidden)) failures.push(`dependência externa de execução encontrada: ${forbidden}`);
}
if (!runtimeSources.includes('native-chart-host')) failures.push('os gráficos nativos da Tesouraria não foram encontrados');
if (runtimeSources.includes('<canvas id="financeChart"')) failures.push('o gráfico financeiro ainda depende de canvas externo');

for (const { file, source } of appSources) {
  const relativePath = path.relative(projectRoot, file).replaceAll(path.sep, '/');
  if (/\b(TODO|FIXME|HACK)\b/.test(source)) failures.push(`${relativePath} contém marcador de trabalho pendente`);
  if (/\bdebugger\s*;/.test(source)) failures.push(`${relativePath} contém debugger`);
}

const targetBlankTags = [...runtimeSources.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)].map(match => match[0]);
for (const tag of targetBlankTags) {
  if (!/rel=["'][^"']*noopener[^"']*noreferrer[^"']*["']/i.test(tag)) {
    failures.push(`link externo sem noopener noreferrer: ${tag.slice(0, 100)}`);
  }
}

if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  failures.push(`a versão deve usar o formato estável x.y.z; encontrada ${packageJson.version}`);
}

if (failures.length) {
  console.error(`Auditoria da versão reprovada:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`Auditoria da versão ${packageJson.version} aprovada: dados e modelo no esquema v${dataEnvelope.schemaVersion}, ${appFiles.length} módulos e dados com ${Buffer.byteLength(dataSource)} bytes.`);
