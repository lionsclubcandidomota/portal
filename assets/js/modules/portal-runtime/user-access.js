import {
  memberForPortalUser,
  normalizePortalUsername,
  userByUsername
} from '../../core/portal-access.js?v=6.46.5';
import { effectivePortalUserRole } from '../../core/portal-leadership.js?v=6.46.5';

const USER_PASSWORD_VERSION = 1;
const USER_PASSWORD_CONTEXT = 'lions-portal-user-password-v1';
const USER_PASSWORD_ITERATIONS = 210000;
const USER_PASSWORD_MIN_LENGTH = 10;
const USER_PASSWORD_MAX_LENGTH = 128;

function cryptoProvider() {
  const provider = globalThis.crypto;
  if (!provider?.subtle || typeof provider.getRandomValues !== 'function') {
    throw new Error('Este navegador não oferece os recursos de segurança necessários para configurar usuários.');
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

function validatePassword(password) {
  const value = String(password ?? '');
  if (value !== value.trim()) {
    throw new Error('A senha não pode começar ou terminar com espaços.');
  }
  if (value.length < USER_PASSWORD_MIN_LENGTH) {
    throw new Error(`A senha deve possuir pelo menos ${USER_PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (value.length > USER_PASSWORD_MAX_LENGTH) {
    throw new Error(`A senha deve possuir no máximo ${USER_PASSWORD_MAX_LENGTH} caracteres.`);
  }
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value) || !/\d/.test(value)) {
    throw new Error('Use uma senha contendo pelo menos uma letra e um número.');
  }
  return value;
}

function randomSalt() {
  const values = new Uint8Array(16);
  cryptoProvider().getRandomValues(values);
  return bytesToHex(values);
}

async function passwordDigest(password, userId, salt, iterations = USER_PASSWORD_ITERATIONS) {
  const provider = cryptoProvider();
  const safeSalt = String(salt || '').trim();
  const safeUserId = String(userId || '').trim();
  const safeIterations = Math.max(100000, Number(iterations || USER_PASSWORD_ITERATIONS));
  if (!safeSalt || !safeUserId) throw new Error('O usuário não possui uma configuração de segurança válida.');

  const keyMaterial = await provider.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password ?? '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await provider.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: new TextEncoder().encode(`${USER_PASSWORD_CONTEXT}:${safeUserId}:${safeSalt}`),
    iterations: safeIterations
  }, keyMaterial, 256);
  return bytesToHex(new Uint8Array(bits));
}

export async function buildPortalUserPassword(password, userId) {
  const safePassword = validatePassword(password);
  const salt = randomSalt();
  return {
    passwordVersion: USER_PASSWORD_VERSION,
    passwordSalt: salt,
    passwordHash: await passwordDigest(safePassword, userId, salt, USER_PASSWORD_ITERATIONS),
    passwordIterations: USER_PASSWORD_ITERATIONS
  };
}

export function portalUserHasValidPasswordProfile(user) {
  return Number(user?.passwordVersion || 0) >= USER_PASSWORD_VERSION
    && /^[a-f0-9]{32}$/i.test(String(user?.passwordSalt || ''))
    && /^[a-f0-9]{64}$/i.test(String(user?.passwordHash || ''))
    && Number(user?.passwordIterations || 0) >= 100000;
}

export async function passwordMatchesPortalUser(password, user) {
  if (!portalUserHasValidPasswordProfile(user)) return false;
  const candidate = await passwordDigest(
    password,
    user.id,
    user.passwordSalt,
    user.passwordIterations
  );
  return hashesMatch(candidate, user.passwordHash);
}

export async function authenticatePortalUser(username, password, state) {
  const normalizedUsername = normalizePortalUsername(username);
  if (!normalizedUsername || !password) return null;

  const user = userByUsername(state, normalizedUsername);
  if (!user || !await passwordMatchesPortalUser(password, user)) return null;

  const access = effectivePortalUserRole(state, user, new Date());
  const role = access.role;
  const member = memberForPortalUser(state, user);
  if (!role || !member) return null;

  return {
    user,
    role,
    assignment: access.assignment,
    member,
    actor: {
      login: user.username,
      name: member.name,
      memberId: member.id,
      userId: user.id,
      roleId: role.id,
      role: role.name
    }
  };
}
