import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_KEEP = 10;
const BACKUP_FILES = Object.freeze(['data/dados.json', 'data/modelo.json']);

function safeTimestamp(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replace('.', '-');
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function existingBackupDirectories(backupsRoot) {
  try {
    const entries = await readdir(backupsRoot, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function pruneLocalBackups(backupsRoot, keep = DEFAULT_KEEP) {
  const directories = await existingBackupDirectories(backupsRoot);
  const excess = directories.slice(0, Math.max(0, directories.length - keep));
  await Promise.all(excess.map(directory => rm(path.join(backupsRoot, directory), { recursive: true, force: true })));
  return excess;
}

export async function createLocalBackup({
  projectRoot = defaultProjectRoot,
  keep = DEFAULT_KEEP,
  now = new Date()
} = {}) {
  const absoluteRoot = path.resolve(projectRoot);
  const packageJson = JSON.parse(await readFile(path.join(absoluteRoot, 'package.json'), 'utf8'));
  const backupsRoot = path.join(absoluteRoot, '.portal-backups');
  const backupName = safeTimestamp(now);
  const backupRoot = path.join(backupsRoot, backupName);
  const metadata = {
    createdAt: now.toISOString(),
    portalVersion: packageJson.version,
    files: []
  };

  await mkdir(backupsRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: false });

  try {
    for (const relativePath of BACKUP_FILES) {
      const sourcePath = path.join(absoluteRoot, relativePath);
      const info = await stat(sourcePath);
      if (!info.isFile()) throw new Error(`${relativePath} não é um arquivo válido.`);
      const content = await readFile(sourcePath);
      const destinationPath = path.join(backupRoot, relativePath);
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await cp(sourcePath, destinationPath);
      metadata.files.push({
        path: relativePath,
        bytes: content.byteLength,
        sha256: sha256(content)
      });
    }

    await writeFile(path.join(backupRoot, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  } catch (error) {
    await rm(backupRoot, { recursive: true, force: true });
    throw error;
  }

  await pruneLocalBackups(backupsRoot, keep);
  return { backupRoot, metadata };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { backupRoot, metadata } = await createLocalBackup();
    console.log(`Backup local criado em ${path.relative(defaultProjectRoot, backupRoot)} (${metadata.files.length} arquivos).`);
  } catch (error) {
    console.error(`Não foi possível criar o backup local: ${error?.message || error}`);
    process.exit(1);
  }
}
