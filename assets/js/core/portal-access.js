import { memberIsActive } from './portal-members.js?v=6.44.1';
export const ACCESS_ROLES = Object.freeze({
  VISITOR: 'visitor',
  ADMIN: 'admin',
  DIRECTOR: 'director',
  USER: 'user'
});

export const ACCESS_CAPABILITIES = Object.freeze({
  VIEW_PRIVATE_DATA: 'view-private-data',
  VIEW_TREASURY: 'view-treasury',
  VIEW_SETTINGS: 'view-settings',
  REFRESH_PANEL: 'refresh-panel',
  WRITE_DATA: 'write-data',
  MANAGE_PEOPLE: 'manage-people',
  MANAGE_AGENDA: 'manage-agenda',
  MANAGE_NOTICES: 'manage-notices',
  MANAGE_TREASURY: 'manage-treasury',
  MANAGE_SETTINGS: 'manage-settings',
  EXPORT_REPORTS: 'export-reports',
  PUBLISH_DATA: 'publish-data',
  DISCARD_DATA: 'discard-data',
  IMPORT_DATA: 'import-data',
  MANAGE_ACCESS: 'manage-access',
  MANAGE_USERS: 'manage-users'
});

export const ACCESS_PERMISSION_DEFINITIONS = Object.freeze([
  Object.freeze({ id: ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA, label: 'Acessar a área administrativa', group: 'Consulta', description: 'Permite entrar no painel e consultar informações internas.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.VIEW_TREASURY, label: 'Consultar a Tesouraria', group: 'Consulta', description: 'Permite visualizar saldos, movimentações, mensalidades e Mútuas.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.REFRESH_PANEL, label: 'Atualizar informações do Portal', group: 'Consulta', description: 'Permite buscar novamente os dados publicados.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.EXPORT_REPORTS, label: 'Gerar relatórios', group: 'Consulta', description: 'Permite abrir relatórios em PDF e baixar arquivos CSV.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.MANAGE_PEOPLE, label: 'Gerenciar associados e aniversariantes', group: 'Edição', description: 'Permite cadastrar, editar e inativar pessoas.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.MANAGE_AGENDA, label: 'Gerenciar eventos e reuniões', group: 'Edição', description: 'Permite cadastrar, editar e excluir compromissos.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.MANAGE_NOTICES, label: 'Gerenciar avisos', group: 'Edição', description: 'Permite cadastrar, editar e excluir comunicados.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.MANAGE_TREASURY, label: 'Gerenciar a Tesouraria', group: 'Edição', description: 'Permite alterar movimentações, contas, mensalidades, famílias e Mútuas.' }),
  Object.freeze({ id: ACCESS_CAPABILITIES.MANAGE_SETTINGS, label: 'Alterar os ajustes do Portal', group: 'Edição', description: 'Permite alterar identidade visual e valores padrão.' })
]);

const VALID_CAPABILITIES = new Set(Object.values(ACCESS_CAPABILITIES));
const ASSIGNABLE_CAPABILITIES = new Set(ACCESS_PERMISSION_DEFINITIONS.map(item => item.id));
const EDIT_CAPABILITIES = new Set([
  ACCESS_CAPABILITIES.MANAGE_PEOPLE,
  ACCESS_CAPABILITIES.MANAGE_AGENDA,
  ACCESS_CAPABILITIES.MANAGE_NOTICES,
  ACCESS_CAPABILITIES.MANAGE_TREASURY,
  ACCESS_CAPABILITIES.MANAGE_SETTINGS
]);

const STANDARD_ROLES = Object.freeze([
  Object.freeze({
    id: 'role-president',
    name: 'Presidente',
    description: 'Acompanha todo o trabalho operacional do clube.',
    system: true,
    active: true,
    permissions: Object.freeze([
      ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
      ACCESS_CAPABILITIES.VIEW_TREASURY,
      ACCESS_CAPABILITIES.REFRESH_PANEL,
      ACCESS_CAPABILITIES.EXPORT_REPORTS,
      ACCESS_CAPABILITIES.MANAGE_PEOPLE,
      ACCESS_CAPABILITIES.MANAGE_AGENDA,
      ACCESS_CAPABILITIES.MANAGE_NOTICES,
      ACCESS_CAPABILITIES.MANAGE_TREASURY
    ])
  }),
  Object.freeze({
    id: 'role-vice-president',
    name: 'Vice-Presidente',
    description: 'Consulta o painel e apoia agenda, avisos e relatórios.',
    system: true,
    active: true,
    permissions: Object.freeze([
      ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
      ACCESS_CAPABILITIES.VIEW_TREASURY,
      ACCESS_CAPABILITIES.REFRESH_PANEL,
      ACCESS_CAPABILITIES.EXPORT_REPORTS,
      ACCESS_CAPABILITIES.MANAGE_AGENDA,
      ACCESS_CAPABILITIES.MANAGE_NOTICES
    ])
  }),
  Object.freeze({
    id: 'role-secretary',
    name: 'Secretário',
    description: 'Mantém pessoas, agenda, reuniões e comunicados atualizados.',
    system: true,
    active: true,
    permissions: Object.freeze([
      ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
      ACCESS_CAPABILITIES.REFRESH_PANEL,
      ACCESS_CAPABILITIES.EXPORT_REPORTS,
      ACCESS_CAPABILITIES.MANAGE_PEOPLE,
      ACCESS_CAPABILITIES.MANAGE_AGENDA,
      ACCESS_CAPABILITIES.MANAGE_NOTICES
    ])
  }),
  Object.freeze({
    id: 'role-treasurer',
    name: 'Tesoureiro',
    description: 'Consulta e mantém os controles financeiros do clube.',
    system: true,
    active: true,
    permissions: Object.freeze([
      ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
      ACCESS_CAPABILITIES.VIEW_TREASURY,
      ACCESS_CAPABILITIES.REFRESH_PANEL,
      ACCESS_CAPABILITIES.EXPORT_REPORTS,
      ACCESS_CAPABILITIES.MANAGE_TREASURY
    ])
  }),
  Object.freeze({
    id: 'role-director',
    name: 'Diretor',
    description: 'Consulta informações internas e relatórios sem realizar alterações.',
    system: true,
    active: true,
    permissions: Object.freeze([
      ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
      ACCESS_CAPABILITIES.VIEW_TREASURY,
      ACCESS_CAPABILITIES.REFRESH_PANEL,
      ACCESS_CAPABILITIES.EXPORT_REPORTS
    ])
  })
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unique(values) {
  return [...new Set(values)];
}

export function normalizePortalUsername(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '')
    .slice(0, 64);
}

export function normalizeAccessPermissions(values, { assignableOnly = true } = {}) {
  const allowed = assignableOnly ? ASSIGNABLE_CAPABILITIES : VALID_CAPABILITIES;
  const permissions = unique((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(value => allowed.has(value)));

  if (permissions.some(permission => EDIT_CAPABILITIES.has(permission))) {
    permissions.push(ACCESS_CAPABILITIES.WRITE_DATA);
  }
  if (permissions.includes(ACCESS_CAPABILITIES.MANAGE_TREASURY)) {
    permissions.push(ACCESS_CAPABILITIES.VIEW_TREASURY);
  }
  if (permissions.includes(ACCESS_CAPABILITIES.MANAGE_SETTINGS)) {
    permissions.push(ACCESS_CAPABILITIES.VIEW_SETTINGS);
  }
  if (permissions.length) permissions.push(ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA);

  return unique(permissions.filter(value => VALID_CAPABILITIES.has(value)));
}

export function defaultAccessRoles() {
  return STANDARD_ROLES.map(role => ({
    ...role,
    permissions: [...role.permissions]
  }));
}

export function normalizeAccessRoleRecord(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  const standard = STANDARD_ROLES.find(role => role.id === source.id) || null;
  const fallback = standard || (!Object.keys(source).length ? STANDARD_ROLES[index] : null);
  const id = String(source.id || fallback?.id || `role-${index + 1}`).trim();
  const permissions = Array.isArray(source.permissions)
    ? source.permissions
    : fallback?.permissions || [];
  return {
    id,
    name: String(source.name || fallback?.name || `Cargo ${index + 1}`).trim().slice(0, 80),
    description: String(source.description || fallback?.description || '').trim().slice(0, 240),
    system: Boolean(standard || source.system || fallback?.system),
    active: source.active !== false,
    permissions: normalizeAccessPermissions(permissions)
  };
}

function safePositiveInteger(value, fallback, minimum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.trunc(number)) : fallback;
}

export function normalizePortalUserRecord(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  return {
    id: String(source.id || `usr-${index + 1}`).trim(),
    memberId: String(source.memberId || '').trim(),
    username: normalizePortalUsername(source.username),
    roleId: String(source.roleId || '').trim(),
    active: source.active !== false,
    passwordVersion: safePositiveInteger(source.passwordVersion, 1, 1),
    passwordSalt: String(source.passwordSalt || '').trim().toLocaleLowerCase('en-US'),
    passwordHash: String(source.passwordHash || '').trim().toLocaleLowerCase('en-US'),
    passwordIterations: safePositiveInteger(source.passwordIterations, 210000, 100000),
    createdAt: String(source.createdAt || ''),
    updatedAt: String(source.updatedAt || '')
  };
}

export function roleById(state, roleId) {
  return (Array.isArray(state?.accessRoles) ? state.accessRoles : [])
    .find(role => role.id === roleId && role.active !== false) || null;
}

export function userByUsername(state, username) {
  const normalized = normalizePortalUsername(username);
  return (Array.isArray(state?.portalUsers) ? state.portalUsers : [])
    .find(user => user.active !== false && user.username === normalized) || null;
}

export function memberForPortalUser(state, user) {
  return (Array.isArray(state?.birthdays) ? state.birthdays : [])
    .find(member => member.id === user?.memberId && memberIsActive(member)) || null;
}

export function permissionDefinition(capability) {
  return ACCESS_PERMISSION_DEFINITIONS.find(item => item.id === capability) || null;
}
