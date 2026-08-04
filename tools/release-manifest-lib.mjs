import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function buildFileManifest({
  root,
  files,
  application,
  version,
  schemaVersion = null,
  artifactType = 'source',
  generatedAt = new Date().toISOString()
}) {
  const entries = [];

  for (const relativePath of [...files].sort((first, second) => first.localeCompare(second))) {
    const content = await readFile(path.join(root, relativePath));
    entries.push({
      path: relativePath.replaceAll(path.sep, '/'),
      bytes: content.byteLength,
      sha256: sha256(content)
    });
  }

  const extensionCount = extension => entries.filter(file => file.path.endsWith(extension)).length;
  return {
    application,
    artifactType,
    version,
    schemaVersion,
    generatedAt,
    summary: {
      files: entries.length,
      javascript: extensionCount('.js') + extensionCount('.mjs'),
      css: extensionCount('.css'),
      tests: entries.filter(file => file.path.startsWith('tests/')).length,
      memberImages: entries.filter(file => file.path.startsWith('public/members/')).length,
      totalBytes: entries.reduce((sum, file) => sum + file.bytes, 0)
    },
    files: entries
  };
}

export function comparableManifest(manifest) {
  return {
    application: manifest.application,
    artifactType: manifest.artifactType || 'source',
    version: manifest.version,
    schemaVersion: manifest.schemaVersion ?? null,
    summary: manifest.summary,
    files: manifest.files
  };
}

export async function verifyFileManifest(root, manifest) {
  const current = await buildFileManifest({
    root,
    files: manifest.files.map(file => file.path),
    application: manifest.application,
    artifactType: manifest.artifactType || 'source',
    version: manifest.version,
    schemaVersion: manifest.schemaVersion ?? null,
    generatedAt: manifest.generatedAt
  });

  return JSON.stringify(comparableManifest(current)) === JSON.stringify(comparableManifest(manifest));
}
