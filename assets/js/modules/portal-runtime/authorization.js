import {
  ACCESS_CAPABILITIES,
  ACCESS_ROLES,
  normalizeAccessPermissions
} from '../../core/portal-access.js?v=6.44.1';

export { ACCESS_CAPABILITIES, ACCESS_ROLES } from '../../core/portal-access.js?v=6.44.1';

const ROLE_POLICIES = Object.freeze({
  [ACCESS_ROLES.VISITOR]: Object.freeze({
    role: ACCESS_ROLES.VISITOR,
    authenticated: false,
    readOnly: true,
    capabilities: Object.freeze([])
  }),
  [ACCESS_ROLES.DIRECTOR]: Object.freeze({
    role: ACCESS_ROLES.DIRECTOR,
    authenticated: true,
    readOnly: true,
    capabilities: Object.freeze([
      ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
      ACCESS_CAPABILITIES.VIEW_TREASURY,
      ACCESS_CAPABILITIES.REFRESH_PANEL,
      ACCESS_CAPABILITIES.EXPORT_REPORTS
    ])
  }),
  [ACCESS_ROLES.ADMIN]: Object.freeze({
    role: ACCESS_ROLES.ADMIN,
    authenticated: true,
    readOnly: false,
    capabilities: Object.freeze(Object.values(ACCESS_CAPABILITIES))
  }),
  [ACCESS_ROLES.USER]: Object.freeze({
    role: ACCESS_ROLES.USER,
    authenticated: true,
    readOnly: true,
    capabilities: Object.freeze([])
  })
});

const VIEW_CAPABILITIES = Object.freeze({
  admin: ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
  treasury: ACCESS_CAPABILITIES.VIEW_TREASURY,
  settings: ACCESS_CAPABILITIES.VIEW_SETTINGS
});

function roleFromSubject(subject) {
  if (typeof subject === 'string') return subject;
  return subject?.accessRole || subject?.role;
}

function customCapabilitiesFromSubject(subject) {
  if (!subject || typeof subject === 'string') return [];
  if (Array.isArray(subject.accessCapabilities)) return subject.accessCapabilities;
  if (Array.isArray(subject.capabilities)) return subject.capabilities;
  return [];
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}-${String(safe.getDate()).padStart(2, '0')}`;
}

export function normalizeAccessRole(role) {
  const value = String(role || '').trim().toLocaleLowerCase('en-US');
  return Object.hasOwn(ROLE_POLICIES, value) ? value : ACCESS_ROLES.VISITOR;
}

export function accessPolicyFor(subject, customCapabilities = []) {
  const role = normalizeAccessRole(roleFromSubject(subject));
  const base = ROLE_POLICIES[role];
  if (role !== ACCESS_ROLES.USER) return base;

  const user = subject && typeof subject !== 'string' ? subject.currentPortalUser || subject.user : null;
  const today = localDateKey();
  const assignmentIsCurrent = !user?.roleStartsOn && !user?.roleEndsOn
    ? true
    : (!user?.roleStartsOn || user.roleStartsOn <= today)
      && (!user?.roleEndsOn || user.roleEndsOn >= today);
  const capabilities = assignmentIsCurrent
    ? normalizeAccessPermissions(
      customCapabilities.length ? customCapabilities : customCapabilitiesFromSubject(subject),
      { assignableOnly: false }
    )
    : [];
  return Object.freeze({
    role,
    authenticated: assignmentIsCurrent,
    readOnly: !capabilities.includes(ACCESS_CAPABILITIES.WRITE_DATA),
    capabilities: Object.freeze(capabilities)
  });
}

export function roleHasCapability(subject, capability) {
  if (!Object.values(ACCESS_CAPABILITIES).includes(capability)) return false;
  return accessPolicyFor(subject).capabilities.includes(capability);
}

export function canAccessView(subject, view) {
  const requiredCapability = VIEW_CAPABILITIES[String(view || '').trim()];
  return !requiredCapability || roleHasCapability(subject, requiredCapability);
}

export function applyAccessRole(model, role, { capabilities = [], user = null, label = '' } = {}) {
  if (!model || typeof model !== 'object') {
    throw new TypeError('applyAccessRole requer um modelo de sessão válido.');
  }
  model.accessRole = normalizeAccessRole(role);
  model.accessCapabilities = model.accessRole === ACCESS_ROLES.USER
    ? normalizeAccessPermissions(capabilities, { assignableOnly: false })
    : [];
  model.currentPortalUser = model.accessRole === ACCESS_ROLES.USER && user ? { ...user } : null;
  model.accessLabel = String(label || '').trim();
  const policy = accessPolicyFor(model);
  model.adminUnlocked = policy.authenticated;
  model.canWrite = roleHasCapability(model, ACCESS_CAPABILITIES.WRITE_DATA);
  return policy;
}

export function clearAccessRole(model) {
  return applyAccessRole(model, ACCESS_ROLES.VISITOR);
}

export function accessSnapshot(model) {
  const policy = accessPolicyFor(model);
  const user = model?.currentPortalUser ? { ...model.currentPortalUser } : null;
  return Object.freeze({
    role: policy.role,
    authenticated: policy.authenticated,
    readOnly: policy.readOnly,
    capabilities: Object.freeze([...policy.capabilities]),
    user,
    label: String(model?.accessLabel || '').trim(),
    canWrite: roleHasCapability(model, ACCESS_CAPABILITIES.WRITE_DATA),
    canRefresh: roleHasCapability(model, ACCESS_CAPABILITIES.REFRESH_PANEL),
    canViewTreasury: roleHasCapability(model, ACCESS_CAPABILITIES.VIEW_TREASURY),
    canViewSettings: roleHasCapability(model, ACCESS_CAPABILITIES.VIEW_SETTINGS),
    canManagePeople: roleHasCapability(model, ACCESS_CAPABILITIES.MANAGE_PEOPLE),
    canManageAgenda: roleHasCapability(model, ACCESS_CAPABILITIES.MANAGE_AGENDA),
    canManageNotices: roleHasCapability(model, ACCESS_CAPABILITIES.MANAGE_NOTICES),
    canManageTreasury: roleHasCapability(model, ACCESS_CAPABILITIES.MANAGE_TREASURY),
    canManageSettings: roleHasCapability(model, ACCESS_CAPABILITIES.MANAGE_SETTINGS),
    canExportReports: roleHasCapability(model, ACCESS_CAPABILITIES.EXPORT_REPORTS),
    canPublish: roleHasCapability(model, ACCESS_CAPABILITIES.PUBLISH_DATA),
    canDiscard: roleHasCapability(model, ACCESS_CAPABILITIES.DISCARD_DATA),
    canImport: roleHasCapability(model, ACCESS_CAPABILITIES.IMPORT_DATA),
    canManageAccess: roleHasCapability(model, ACCESS_CAPABILITIES.MANAGE_ACCESS),
    canManageUsers: roleHasCapability(model, ACCESS_CAPABILITIES.MANAGE_USERS)
  });
}
