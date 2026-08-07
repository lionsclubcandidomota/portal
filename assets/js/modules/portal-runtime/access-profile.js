import {
  ACCESS_CAPABILITIES,
  ACCESS_ROLES,
  roleHasCapability
} from './authorization.js?v=6.47.2';

export { ACCESS_ROLES } from './authorization.js?v=6.47.2';

const DIRECTOR_PROFILE_VERSION = 2;
const DIRECTOR_PASSWORD_CONTEXT = 'lions-portal-director-password-v2';
const DIRECTOR_PASSWORD_ITERATIONS = 100000;
const DIRECTOR_WORKER_MAX_ITERATIONS = 100000;
const DIRECTOR_PASSWORD_MIN_LENGTH = 10;
const DIRECTOR_PASSWORD_MAX_LENGTH = 128;

function cryptoProvider() {
  const provider = globalThis.crypto;
  if (!provider?.subtle || typeof provider.getRandomValues !== 'function') {
    throw new Error('Este navegador não oferece os recursos de segurança necessários para configurar a senha da Diretoria.');
  }
  return provider;
}

function bytesToHex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('en-US');
  if (!/^[a-f0-9]+$/.test(normalized) || normalized.length % 2 !== 0) return null;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

function randomSalt() {
  const values = new Uint8Array(16);
  cryptoProvider().getRandomValues(values);
  return bytesToHex(values);
}

function normalizePassword(password, { validate = false } = {}) {
  const value = String(password ?? '');
  if (!validate) return value;

  if (value !== value.trim()) {
    throw new Error('A senha da Diretoria não pode começar ou terminar com espaços.');
  }
  if (value.length < DIRECTOR_PASSWORD_MIN_LENGTH) {
    throw new Error(`A senha da Diretoria deve possuir pelo menos ${DIRECTOR_PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (value.length > DIRECTOR_PASSWORD_MAX_LENGTH) {
    throw new Error(`A senha da Diretoria deve possuir no máximo ${DIRECTOR_PASSWORD_MAX_LENGTH} caracteres.`);
  }
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value) || !/\d/.test(value)) {
    throw new Error('Use uma senha contendo pelo menos uma letra e um número.');
  }
  return value;
}

async function passwordDigest(password, salt, iterations = DIRECTOR_PASSWORD_ITERATIONS) {
  const provider = cryptoProvider();
  const safePassword = normalizePassword(password);
  const safeSalt = String(salt || '').trim();
  const safeIterations = Math.max(100000, Number(iterations || DIRECTOR_PASSWORD_ITERATIONS));
  if (!safeSalt) throw new Error('O perfil Diretoria não possui um identificador de segurança válido.');

  const keyMaterial = await provider.subtle.importKey(
    'raw',
    new TextEncoder().encode(safePassword),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await provider.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: new TextEncoder().encode(`${DIRECTOR_PASSWORD_CONTEXT}:${safeSalt}`),
    iterations: safeIterations
  }, keyMaterial, 256);
  return bytesToHex(new Uint8Array(bits));
}

function hashesMatch(first, second) {
  const firstBytes = hexToBytes(first);
  const secondBytes = hexToBytes(second);
  if (!firstBytes || !secondBytes || firstBytes.length !== secondBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < firstBytes.length; index += 1) {
    difference |= firstBytes[index] ^ secondBytes[index];
  }
  return difference === 0;
}

function directorSourceFromState(state) {
  const source = state?.settings?.accessProfiles?.director;
  return source && typeof source === 'object' && source.enabled !== false ? source : null;
}

export function directorProfileFromState(state) {
  const source = directorSourceFromState(state);
  if (!source) return null;

  const version = Number(source.version || 0);
  const credentialType = String(source.credentialType || '').trim().toLocaleLowerCase('en-US');
  const salt = String(source.salt || '').trim().toLocaleLowerCase('en-US');
  const passwordHash = String(source.passwordHash || '').trim().toLocaleLowerCase('en-US');
  const iterations = Math.max(100000, Number(source.iterations || DIRECTOR_PASSWORD_ITERATIONS));

  if (
    version < DIRECTOR_PROFILE_VERSION
    || credentialType !== 'password'
    || !/^[a-f0-9]{32}$/.test(salt)
    || !/^[a-f0-9]{64}$/.test(passwordHash)
  ) return null;

  return {
    version,
    credentialType: 'password',
    enabled: true,
    salt,
    passwordHash,
    iterations,
    label: String(source.label || 'Diretoria').trim() || 'Diretoria',
    configuredAt: String(source.configuredAt || ''),
    configuredBy: String(source.configuredBy || '').trim()
  };
}


export function directorProfileRequiresWorkerMigration(state) {
  const profile = directorProfileFromState(state);
  return Boolean(profile && Number(profile.iterations || 0) > DIRECTOR_WORKER_MAX_ITERATIONS);
}

export function hasLegacyDirectorTokenProfile(state) {
  const source = directorSourceFromState(state);
  if (!source || directorProfileFromState(state)) return false;
  return /^[a-f0-9]{64}$/i.test(String(source.fingerprint || '').trim());
}

export async function passwordMatchesDirectorProfile(password, state) {
  const profile = directorProfileFromState(state);
  if (!profile) return false;
  const candidate = await passwordDigest(password, profile.salt, profile.iterations);
  return hashesMatch(candidate, profile.passwordHash);
}

export async function buildDirectorProfile(password, configuredBy = '') {
  const safePassword = normalizePassword(password, { validate: true });
  const salt = randomSalt();
  return {
    version: DIRECTOR_PROFILE_VERSION,
    credentialType: 'password',
    enabled: true,
    label: 'Diretoria',
    salt,
    passwordHash: await passwordDigest(safePassword, salt, DIRECTOR_PASSWORD_ITERATIONS),
    iterations: DIRECTOR_PASSWORD_ITERATIONS,
    configuredAt: new Date().toISOString(),
    configuredBy: String(configuredBy || '').trim()
  };
}

export function ensureAccessProfiles(settings) {
  if (!settings || typeof settings !== 'object') return null;
  if (!settings.accessProfiles || typeof settings.accessProfiles !== 'object') {
    settings.accessProfiles = {};
  }
  return settings.accessProfiles;
}

export function createAccessProfileActions(context, persistence) {
  const { model, dependencies } = context;

  const requireAdministrator = () => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.MANAGE_ACCESS)) {
      throw new Error('Somente o perfil Administrador pode configurar a senha da Diretoria.');
    }
  };

  const configureDirectorProfile = async password => {
    requireAdministrator();
    const profile = await buildDirectorProfile(
      password,
      model.auditActor?.login || model.auditActor?.name || 'Administrador'
    );
    const settings = context.currentState().settings || (context.currentState().settings = {});
    const profiles = ensureAccessProfiles(settings);
    profiles.director = profile;
    persistence.persist('Senha do perfil Diretoria configurada.');
    dependencies.renderCurrentView?.();
    return { profile: directorProfileFromState(context.currentState()) };
  };

  const removeDirectorProfile = async () => {
    requireAdministrator();
    const settings = context.currentState().settings || (context.currentState().settings = {});
    const profiles = ensureAccessProfiles(settings);
    if (!profiles?.director) return { ok: false, reason: 'not-configured' };
    delete profiles.director;
    persistence.persist('Senha do perfil Diretoria removida.');
    dependencies.renderCurrentView?.();
    return { ok: true };
  };

  return {
    configureDirectorProfile,
    removeDirectorProfile
  };
}
