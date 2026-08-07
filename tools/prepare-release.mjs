import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, label, timeout = 180_000) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR || '0' },
    timeout
  });

  if (result.error) {
    console.error(`${label} falhou: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} falhou com código ${result.status ?? 'desconhecido'}.`);
    process.exit(result.status || 1);
  }
}

run(process.execPath, ['tools/create-local-backup.mjs'], '1/7 Backup local');
run(process.execPath, ['tools/migrate-official-data.mjs'], '2/7 Migração dos dados');
run(process.execPath, ['tools/build-css.mjs'], '3/7 Geração do CSS');
run(npmCommand, ['run', 'quality'], '4/7 Portões de qualidade');
run(process.execPath, ['tools/release-manifest.mjs'], '5/7 Geração do manifesto');
run(process.execPath, ['tools/release-audit.mjs'], '6/7 Auditoria do release');
run(process.execPath, ['tools/release-manifest.mjs', '--check'], '7/7 Verificação do manifesto');

console.log('\nRelease preparado e validado com sucesso.');
