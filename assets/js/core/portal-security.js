const SENSITIVE_KEY_NAMES = Object.freeze(new Set([
  'adminpassword',
  'adminuser',
  'apikey',
  'accesstoken',
  'clientsecret',
  'credential',
  'credentials',
  'githubtoken',
  'password',
  'personalaccesstoken',
  'secret',
  'senha',
  'token'
]));

const TOKEN_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const TOKEN_WHITESPACE = /\s/;

function cloneValue(value) {
  if (value == null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeKeyName(key) {
  return String(key || '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
}

export function isSensitivePortalField(key) {
  return SENSITIVE_KEY_NAMES.has(normalizeKeyName(key));
}

export function findSensitivePortalFields(value, basePath = '$') {
  const findings = [];
  const visit = (current, path) => {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      const nestedPath = `${path}.${key}`;
      if (isSensitivePortalField(key)) findings.push(nestedPath);
      else visit(nestedValue, nestedPath);
    }
  };
  visit(value, basePath);
  return findings;
}

export function stripSensitivePortalFields(value) {
  const source = cloneValue(value);
  const clean = current => {
    if (!current || typeof current !== 'object') return current;
    if (Array.isArray(current)) return current.map(clean);

    return Object.entries(current).reduce((result, [key, nestedValue]) => {
      if (!isSensitivePortalField(key)) result[key] = clean(nestedValue);
      return result;
    }, {});
  };
  return clean(source);
}

export function normalizeGitHubToken(value) {
  const token = String(value || '').trim();
  if (!token) throw new Error('Informe sua credencial de acesso.');
  if (token.length < 8) throw new Error('O valor da credencial é muito curto.');
  if (token.length > 1024) throw new Error('A credencial informada excede o tamanho permitido.');
  if (TOKEN_CONTROL_CHARACTERS.test(token) || TOKEN_WHITESPACE.test(token)) {
    throw new Error('A credencial contém espaços ou caracteres inválidos. Informe somente o valor da credencial.');
  }
  return token;
}

export function createSecuritySummary(state) {
  const sensitivePaths = findSensitivePortalFields(state);
  return {
    safe: sensitivePaths.length === 0,
    sensitivePaths
  };
}
