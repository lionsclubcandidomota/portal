const PRIVATE_COLLECTION_FIELDS = Object.freeze([
  'treasuryAccounts',
  'treasuryCategories',
  'familyGroups',
  'mutualGroups',
  'treasury'
]);

const PRIVATE_SETTING_FIELDS = Object.freeze([
  'membershipMonthlyFee',
  'membershipFamilyPrimaryFee',
  'membershipFamilyAdditionalFee',
  'accessProfiles'
]);

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function publicDirectorProfile(profile) {
  const source = objectValue(profile);
  if (!source.enabled) return undefined;
  return {
    version: Number(source.version || 2),
    credentialType: String(source.credentialType || 'password'),
    enabled: true,
    label: String(source.label || 'Diretoria'),
    configuredAt: String(source.configuredAt || '')
  };
}

export function createPublicPortalState(state = {}) {
  const source = cloneValue(objectValue(state));
  const settings = objectValue(source.settings);
  const director = publicDirectorProfile(settings.accessProfiles?.director);

  for (const field of PRIVATE_COLLECTION_FIELDS) source[field] = [];
  for (const field of PRIVATE_SETTING_FIELDS) delete settings[field];

  settings.accessProfiles = director ? { director } : {};
  source.settings = settings;
  return source;
}

export function createPrivatePortalState(state = {}) {
  const source = objectValue(state);
  const settings = objectValue(source.settings);
  return {
    version: 1,
    settings: PRIVATE_SETTING_FIELDS.reduce((result, field) => {
      if (Object.prototype.hasOwnProperty.call(settings, field)) {
        result[field] = cloneValue(settings[field]);
      }
      return result;
    }, {}),
    ...PRIVATE_COLLECTION_FIELDS.reduce((result, field) => {
      result[field] = cloneValue(Array.isArray(source[field]) ? source[field] : []);
      return result;
    }, {})
  };
}

export function mergePublicAndPrivatePortalState(publicState = {}, privateState = {}) {
  const publicSource = cloneValue(objectValue(publicState));
  const privateSource = objectValue(privateState);
  const privateSettings = objectValue(privateSource.settings);

  publicSource.settings = {
    ...objectValue(publicSource.settings),
    ...cloneValue(privateSettings)
  };

  for (const field of PRIVATE_COLLECTION_FIELDS) {
    if (Array.isArray(privateSource[field])) publicSource[field] = cloneValue(privateSource[field]);
  }

  return publicSource;
}

export function hasPrivatePortalData(state = {}) {
  const source = objectValue(state);
  if (PRIVATE_COLLECTION_FIELDS.some(field => Array.isArray(source[field]) && source[field].length > 0)) {
    return true;
  }
  const settings = objectValue(source.settings);
  if (Number(settings.membershipMonthlyFee || 0) !== 0) return true;
  if (Number(settings.membershipFamilyPrimaryFee || 0) !== 0) return true;
  if (Number(settings.membershipFamilyAdditionalFee || 0) !== 0) return true;
  const director = objectValue(settings.accessProfiles?.director);
  return Boolean(director.passwordHash || director.salt || director.fingerprint || director.tokenHash);
}

export const PORTAL_PRIVATE_COLLECTION_FIELDS = PRIVATE_COLLECTION_FIELDS;
