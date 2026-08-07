import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CURRENT_SCHEMA_VERSION,
  createPortalEnvelope,
  migratePortalPayload
} from '../assets/js/core/portal-schema.js';
import { preparePortalMediaForPublication } from '../assets/js/core/portal-media.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['data/modelo.json'];

let totalAssets = 0;
for (const relativePath of targets) {
  const targetPath = path.resolve(root, relativePath);
  const payload = JSON.parse(await readFile(targetPath, 'utf8'));
  const migrated = migratePortalPayload(payload);
  const prepared = preparePortalMediaForPublication(migrated.state);

  for (const asset of prepared.assets) {
    const outputPath = path.resolve(root, asset.path);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(asset.content, 'base64'));
  }

  const envelope = createPortalEnvelope(prepared.state, {
    ...(payload.exportedAt ? { exportedAt: payload.exportedAt } : {}),
    ...(payload.savedAt ? { savedAt: payload.savedAt } : {}),
    ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
    ...(payload.deploymentId ? { deploymentId: payload.deploymentId } : {})
  });
  await writeFile(targetPath, `${JSON.stringify(envelope, null, 2)}\n`);
  totalAssets += prepared.assets.length;
  console.log(`${relativePath}: ${prepared.assets.length} arquivo(s) extraído(s), esquema v${CURRENT_SCHEMA_VERSION}.`);
}

console.log(`Migração de mídia concluída: ${totalAssets} arquivo(s) gerado(s).`);
