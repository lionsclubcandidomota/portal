import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPortalEnvelope, migratePortalPayload } from '../assets/js/core/portal-schema.js?v=6.46.13';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFiles = ['data/dados.json', 'data/modelo.json'];

for (const relativePath of dataFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  const payload = JSON.parse(await readFile(absolutePath, 'utf8'));
  const migrated = migratePortalPayload(payload);
  if (!migrated.migrated) {
    console.log(`${relativePath}: esquema ${migrated.schemaVersion} já está atualizado.`);
    continue;
  }

  const metadata = {
    ...(payload.exportedAt ? { exportedAt: payload.exportedAt } : {}),
    ...(payload.savedAt ? { savedAt: payload.savedAt } : {}),
    ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
    ...(payload.deploymentId ? { deploymentId: payload.deploymentId } : {})
  };
  const envelope = createPortalEnvelope(migrated.state, metadata);
  await writeFile(absolutePath, `${JSON.stringify(envelope, null, 2)}\n`);
  console.log(`${relativePath}: esquema ${migrated.sourceSchemaVersion} migrado para ${migrated.schemaVersion}.`);
}
