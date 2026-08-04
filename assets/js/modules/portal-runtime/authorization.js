export const ACCESS_ROLES = Object.freeze({
  VISITOR: 'visitor',
  ADMIN: 'admin',
  DIRECTOR: 'director'
});

export const ACCESS_CAPABILITIES = Object.freeze({
  VIEW_PRIVATE_DATA: 'view-private-data',
  VIEW_TREASURY: 'view-treasury',
  VIEW_SETTINGS: 'view-settings',
  REFRESH_PANEL: 'refresh-panel',
  WRITE_DATA: 'write-data',
  PUBLISH_DATA: 'publish-data',
  DISCARD_DATA: 'discard-data',
  MANAGE_ACCESS: 'manage-access'
});

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
      ACCESS_CAPABILITIES.REFRESH_PANEL
    ])
  }),
  [ACCESS_ROLES.ADMIN]: Object.freeze({
    role: ACCESS_ROLES.ADMIN,
    authenticated: true,
    readOnly: false,
    capabilities: Object.freeze(Object.values(ACCESS_CAPABILITIES))
  })
});

const VIEW_CAPABILITIES = Object.freeze({
  treasury: ACCESS_CAPABILITIES.VIEW_TREASURY,
  settings: ACCESS_CAPABILITIES.VIEW_SETTINGS
});

export function normalizeAccessRole(role) {
  const value = String(role || '').trim().toLocaleLowerCase('en-US');
  return Object.hasOwn(ROLE_POLICIES, value) ? value : ACCESS_ROLES.VISITOR;
}

export function accessPolicyFor(role) {
  return ROLE_POLICIES[normalizeAccessRole(role)];
}

export function roleHasCapability(role, capability) {
  if (!Object.values(ACCESS_CAPABILITIES).includes(capability)) return false;
  return accessPolicyFor(role).capabilities.includes(capability);
}

export function canAccessView(role, view) {
  const requiredCapability = VIEW_CAPABILITIES[String(view || '').trim()];
  return !requiredCapability || roleHasCapability(role, requiredCapability);
}

export function applyAccessRole(model, role) {
  if (!model || typeof model !== 'object') {
    throw new TypeError('applyAccessRole requer um modelo de sessão válido.');
  }
  const policy = accessPolicyFor(role);
  model.accessRole = policy.role;
  model.adminUnlocked = policy.authenticated;
  model.canWrite = roleHasCapability(policy.role, ACCESS_CAPABILITIES.WRITE_DATA);
  return policy;
}

export function clearAccessRole(model) {
  return applyAccessRole(model, ACCESS_ROLES.VISITOR);
}

export function accessSnapshot(model) {
  const policy = accessPolicyFor(model?.accessRole);
  return Object.freeze({
    role: policy.role,
    authenticated: policy.authenticated,
    readOnly: policy.readOnly,
    canWrite: roleHasCapability(policy.role, ACCESS_CAPABILITIES.WRITE_DATA),
    canRefresh: roleHasCapability(policy.role, ACCESS_CAPABILITIES.REFRESH_PANEL),
    canViewTreasury: roleHasCapability(policy.role, ACCESS_CAPABILITIES.VIEW_TREASURY),
    canViewSettings: roleHasCapability(policy.role, ACCESS_CAPABILITIES.VIEW_SETTINGS),
    canPublish: roleHasCapability(policy.role, ACCESS_CAPABILITIES.PUBLISH_DATA),
    canDiscard: roleHasCapability(policy.role, ACCESS_CAPABILITIES.DISCARD_DATA),
    canManageAccess: roleHasCapability(policy.role, ACCESS_CAPABILITIES.MANAGE_ACCESS)
  });
}
