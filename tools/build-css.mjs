import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssRoot = path.join(projectRoot, 'assets', 'css');
const outputPath = path.join(cssRoot, 'app.css');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));

// A ordem preserva a cascata histórica. Fontes migradas permanecem no mesmo ponto
// relativo enquanto a camada legacy é reduzida gradualmente e de forma mensurável.
export const CSS_SOURCES = Object.freeze([
  'foundations/application-shell.css',
  'components/interaction-foundation.css',
  'components/structured-content.css',
  'pages/admin-operations.css',
  'pages/treasury-records.css',
  'pages/notices.css',
  'components/publication-progress.css',
  'tokens.css',
  'base.css',
  'layout.css',
  'components/core.css',
  'responsive.css',
  'pages/agenda.css',
  'components/markdown.css',
  'components/responsive-guardrails.css',
  'pages/responsive-workflows.css',
  'pages/treasury-workflows.css',
  'components/interface-polish.css',
  'pages/admin-dashboard.css',
  'components/publication-center.css',
  'pages/treasury-navigation.css',
  'pages/memberships.css',
  'components/publication-review.css',
  'components/audit-log.css',
  'components/recovery-center.css',
  'components/membership-actions-menu.css',
  'components/native-charts.css'
]);

export async function buildCssBundle() {
  const sections = await Promise.all(CSS_SOURCES.map(async relativePath => {
    const sourcePath = path.join(cssRoot, relativePath);
    const content = await readFile(sourcePath, 'utf8');
    return `/* ===== ${relativePath} ===== */\n${content.trim()}\n`;
  }));

  return [
    `/* Portal Lions v${packageJson.version} — arquivo gerado. Não edite diretamente. */`,
    '/* Execute `npm run build:css` após alterar os arquivos-fonte. */',
    '',
    ...sections
  ].join('\n');
}

async function runCli() {
  const bundle = await buildCssBundle();

  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = await readFile(outputPath, 'utf8');
    } catch {
      console.error('assets/css/app.css ainda não foi gerado.');
      process.exitCode = 1;
    }

    if (current !== bundle) {
      console.error('assets/css/app.css está desatualizado. Execute npm run build:css.');
      process.exitCode = 1;
    } else {
      console.log(`CSS validado: ${CSS_SOURCES.length} fontes consolidadas.`);
    }
  } else {
    await writeFile(outputPath, bundle, 'utf8');
    console.log(`CSS gerado em assets/css/app.css (${CSS_SOURCES.length} fontes).`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
