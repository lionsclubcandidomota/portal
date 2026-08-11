import {
  ACCESS_PERMISSION_DEFINITIONS,
  normalizeAccessPermissions,
  normalizePortalUsername,
  permissionDefinition,
  roleById
} from '../core/portal-access.js?v=6.46.7';
import {
  assignmentDateRangeIsValid,
  createLeadershipAssignment,
  currentLeadershipRole,
  currentLionYear,
  leadershipAssignmentStatus,
  leadershipAssignmentsForMember,
  lionYearBounds,
  lionYearForDate,
  normalizeLionYear,
  overlappingLeadershipAssignments,
  transitionLeadershipRole
} from '../core/portal-leadership.js?v=6.46.7';
import { memberPhotoSourceSet } from '../core/member-photo-sources.js?v=6.46.7';
import { memberIsActive } from '../core/portal-members.js?v=6.46.7';
import { escapeHtml, uid } from '../utils.js';
import { buildPortalUserPassword } from './portal-runtime/user-access.js?v=6.46.7';
import { uiIcon } from './visual-helpers.js?v=6.46.7';

function memberById(state, memberId) {
  return (Array.isArray(state?.birthdays) ? state.birthdays : []).find(member => member.id === memberId) || null;
}

function activeMembers(state) {
  return (Array.isArray(state?.birthdays) ? state.birthdays : [])
    .filter(memberIsActive)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));
}

function activeRoles(state) {
  return (Array.isArray(state?.accessRoles) ? state.accessRoles : [])
    .filter(role => role.active !== false)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));
}

function rolePermissionSummary(role) {
  const labels = (Array.isArray(role?.permissions) ? role.permissions : [])
    .map(permissionDefinition)
    .filter(Boolean)
    .map(item => item.label);
  return labels.length ? labels.slice(0, 3).join(' · ') + (labels.length > 3 ? ` +${labels.length - 3}` : '') : 'Somente acesso básico';
}

function statusBadge(active) {
  return `<span class="access-status ${active ? 'is-active' : 'is-inactive'}">${active ? 'Ativo' : 'Inativo'}</span>`;
}

function formatDate(value) {
  const normalized = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '—';
  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
}

function assignmentStatusLabel(assignment) {
  const status = leadershipAssignmentStatus(assignment);
  if (status === 'current') return { label: 'Vigente', className: 'is-current' };
  if (status === 'future') return { label: 'Próximo', className: 'is-future' };
  if (status === 'inactive') return { label: 'Desativado', className: 'is-inactive' };
  return { label: 'Encerrado', className: 'is-past' };
}

function memberAvatar(member, { historical = false } = {}) {
  const name = String(member?.name || 'Associado').trim() || 'Associado';
  const photo = String(member?.photo || '').trim();
  const classes = `access-user-avatar${historical ? ' is-history-avatar' : ''}${photo ? ' has-photo' : ''}`;
  if (!photo) return `<div class="${classes}" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;

  const sourceSet = memberPhotoSourceSet(photo);
  const responsive = sourceSet
    ? ` srcset="${escapeHtml(sourceSet)}" sizes="${historical ? '48px' : '42px'}" data-photo-fallback="${escapeHtml(photo)}"`
    : '';
  const size = historical ? 48 : 42;
  return `<div class="${classes}"><img src="${escapeHtml(photo)}"${responsive} alt="Foto de ${escapeHtml(name)}" width="${size}" height="${size}" loading="lazy" decoding="async" fetchpriority="low"></div>`;
}

function sectionToggleHtml({ key, title, description, count, open }) {
  return `<button class="access-section-toggle" type="button" data-access-toggle="${escapeHtml(key)}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="accessSection-${escapeHtml(key)}">
    <span class="access-section-toggle-icon" aria-hidden="true">${uiIcon('chevron-down')}</span>
    <span class="access-section-toggle-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>
    <span class="access-section-count">${escapeHtml(String(count))}</span>
  </button>`;
}

function collapsibleSectionHtml({ key, title, description, count, action, content, open }) {
  return `<section class="access-management-section access-collapsible-section ${open ? 'is-open' : ''}" data-access-section="${escapeHtml(key)}">
    <div class="access-section-heading">${sectionToggleHtml({ key, title, description, count, open })}${action}</div>
    <div class="access-section-body" id="accessSection-${escapeHtml(key)}" ${open ? '' : 'hidden'}>${content}</div>
  </section>`;
}

function historyHtml(state, yearOpenState = new Map()) {
  const assignments = (Array.isArray(state.leadershipAssignments) ? state.leadershipAssignments : [])
    .slice()
    .sort((first, second) => {
      const year = String(second.lionYear || '').localeCompare(String(first.lionYear || ''));
      return year || String(second.startsOn || '').localeCompare(String(first.startsOn || ''));
    });
  if (!assignments.length) return '<div class="empty">Nenhum cargo foi registrado por Ano Leonístico.</div>';

  const groups = new Map();
  assignments.forEach(assignment => {
    const items = groups.get(assignment.lionYear) || [];
    items.push(assignment);
    groups.set(assignment.lionYear, items);
  });

  const currentYear = currentLionYear();
  return [...groups.entries()].map(([lionYear, items]) => {
    const safeYear = String(lionYear || '').replace(/[^0-9A-Za-z_-]/g, '-');
    const open = yearOpenState.has(lionYear) ? yearOpenState.get(lionYear) : lionYear === currentYear;
    return `<section class="leadership-year-group ${open ? 'is-open' : ''}" data-leadership-year="${escapeHtml(lionYear)}">
      <button class="leadership-year-heading" type="button" data-access-year-toggle="${escapeHtml(lionYear)}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="leadershipYear-${escapeHtml(safeYear)}">
        <span class="leadership-year-heading-main"><span class="leadership-year-chevron" aria-hidden="true">${uiIcon('chevron-down')}</span><span><small class="admin-eyebrow">Ano Leonístico</small><strong>AL ${escapeHtml(lionYear)}</strong></span></span>
        <span class="leadership-year-count">${items.length} registro(s)</span>
      </button>
      <div class="leadership-history-list" id="leadershipYear-${escapeHtml(safeYear)}" ${open ? '' : 'hidden'}>${items.map(assignment => {
        const member = memberById(state, assignment.memberId);
        const role = roleById(state, assignment.roleId) || (state.accessRoles || []).find(item => item.id === assignment.roleId);
        const status = assignmentStatusLabel(assignment);
        return `<article class="leadership-history-card">
          ${memberAvatar(member, { historical: true })}
          <div class="leadership-history-main"><div class="access-user-heading"><h4>${escapeHtml(member?.name || 'Associado não encontrado')}</h4><span class="leadership-status ${status.className}">${status.label}</span></div><p>${escapeHtml(role?.name || 'Cargo não encontrado')}</p><small>${formatDate(assignment.startsOn)} a ${formatDate(assignment.endsOn)}${assignment.notes ? ` · ${escapeHtml(assignment.notes)}` : ''}</small></div>
          <div class="access-user-actions"><button class="btn btn-ghost btn-sm" type="button" data-access-edit-assignment="${escapeHtml(assignment.id)}">Editar</button></div>
        </article>`;
      }).join('')}</div>
    </section>`;
  }).join('');
}

function managerHtml(state, sectionOpenState = {}, yearOpenState = new Map()) {
  const roles = Array.isArray(state.accessRoles) ? state.accessRoles : [];
  const users = Array.isArray(state.portalUsers) ? state.portalUsers : [];
  const assignments = Array.isArray(state.leadershipAssignments) ? state.leadershipAssignments : [];
  const currentYear = currentLionYear();
  const currentLeaders = assignments.filter(assignment => leadershipAssignmentStatus(assignment) === 'current').length;
  const roleCards = roles.map(role => {
    const linked = assignments.filter(assignment => assignment.roleId === role.id).length;
    return `<article class="access-role-card">
      <div class="access-role-card-main"><div class="access-role-icon">${uiIcon('shield')}</div><div><div class="access-role-heading"><h4>${escapeHtml(role.name)}</h4>${role.system ? '<span class="badge badge-muted">Padrão</span>' : ''}${statusBadge(role.active !== false)}</div><p>${escapeHtml(role.description || 'Sem descrição.')}</p><small>${escapeHtml(rolePermissionSummary(role))}</small></div></div>
      <div class="access-card-footer"><span>${linked} registro(s) no histórico</span><div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-access-edit-role="${escapeHtml(role.id)}">Editar</button>${role.system ? '' : `<button class="btn btn-danger btn-sm" type="button" data-access-delete-role="${escapeHtml(role.id)}">Excluir</button>`}</div></div>
    </article>`;
  }).join('');
  const userCards = users.map(user => {
    const member = memberById(state, user.memberId);
    const current = currentLeadershipRole(state, user.memberId);
    const role = current.role;
    const historyCount = leadershipAssignmentsForMember(state, user.memberId).length;
    return `<article class="access-user-card">
      ${memberAvatar(member)}
      <div class="access-user-main"><div class="access-user-heading"><h4>${escapeHtml(member?.name || 'Associado não encontrado')}</h4>${statusBadge(user.active !== false)}</div><p>@${escapeHtml(user.username)}</p><small>${role ? `${escapeHtml(role.name)} · AL ${escapeHtml(current.assignment?.lionYear || currentYear)}` : 'Sem cargo vigente'} · ${historyCount} registro(s)</small></div>
      <div class="access-user-actions"><button class="btn btn-ghost btn-sm" type="button" data-access-edit-user="${escapeHtml(user.id)}">Editar</button><button class="btn btn-danger btn-sm" type="button" data-access-delete-user="${escapeHtml(user.id)}">Excluir</button></div>
    </article>`;
  }).join('');

  const rolesOpen = sectionOpenState.roles !== false;
  const usersOpen = sectionOpenState.users !== false;
  const historyOpen = sectionOpenState.history !== false;

  return `<div class="access-management">
    <section class="access-management-intro"><div><span class="admin-eyebrow">Controle de acesso</span><h3>Usuários, cargos e histórico</h3><p>Os acessos acompanham o cargo vigente no Ano Leonístico. Ao terminar o período, as permissões deixam de valer automaticamente.</p></div><div class="access-management-stats has-four"><span><strong>${users.length}</strong><small>usuários</small></span><span><strong>${roles.length}</strong><small>cargos</small></span><span><strong>${currentLeaders}</strong><small>vigentes</small></span><span><strong>${escapeHtml(currentYear)}</strong><small>AL atual</small></span></div></section>
    <div class="notice medium"><strong>${uiIcon('shield')} Permissões por período</strong><p>O histórico é preservado. Um usuário só entra quando possui um cargo vigente na data atual.</p></div>
    ${collapsibleSectionHtml({ key: 'roles', title: 'Cargos e permissões', description: 'Defina o que cada responsabilidade permite fazer.', count: roles.length, open: rolesOpen, action: `<button class="btn btn-primary btn-sm" type="button" id="createAccessRoleBtn">${uiIcon('plus')} Novo cargo</button>`, content: `<div class="access-role-grid">${roleCards || '<div class="empty">Nenhum cargo cadastrado.</div>'}</div>` })}
    ${collapsibleSectionHtml({ key: 'users', title: 'Usuários individuais', description: 'O usuário permanece vinculado ao associado; o cargo ativo vem do histórico.', count: users.length, open: usersOpen, action: `<button class="btn btn-primary btn-sm" type="button" id="createPortalUserBtn">${uiIcon('plus')} Novo usuário</button>`, content: `<div class="access-user-list">${userCards || '<div class="empty">Nenhum usuário individual cadastrado.</div>'}</div>` })}
    ${collapsibleSectionHtml({ key: 'history', title: 'Histórico por Ano Leonístico', description: 'Registre cargos atuais, anteriores e futuros sem apagar o histórico.', count: assignments.length, open: historyOpen, action: `<button class="btn btn-primary btn-sm" type="button" id="createLeadershipAssignmentBtn">${uiIcon('plus')} Nova designação</button>`, content: `<div class="leadership-history">${historyHtml(state, yearOpenState)}</div>` })}
  </div>`;
}

function permissionFields(selected = []) {
  const selectedSet = new Set(selected);
  const groups = new Map();
  ACCESS_PERMISSION_DEFINITIONS.forEach(permission => {
    const items = groups.get(permission.group) || [];
    items.push(permission);
    groups.set(permission.group, items);
  });
  return [...groups.entries()].map(([group, permissions]) => `<fieldset class="access-permission-group"><legend>${escapeHtml(group)}</legend><div class="access-permission-list">${permissions.map(permission => `<label class="access-permission-option"><input type="checkbox" name="permissions" value="${escapeHtml(permission.id)}" ${selectedSet.has(permission.id) ? 'checked' : ''}><span><strong>${escapeHtml(permission.label)}</strong><small>${escapeHtml(permission.description)}</small></span></label>`).join('')}</div></fieldset>`).join('');
}

function roleFormHtml(role) {
  return `<form class="access-form" id="accessRoleForm"><div class="access-form-heading"><div class="access-role-icon">${uiIcon('shield')}</div><div><span class="admin-eyebrow">${role ? 'Editar cargo' : 'Novo cargo'}</span><h3>${escapeHtml(role?.name || 'Definir responsabilidade')}</h3></div></div><div class="form-grid"><label class="form-field"><span>Nome <span class="required-mark">*</span></span><input name="name" value="${escapeHtml(role?.name || '')}" maxlength="80" required></label><label class="form-field full-row"><span>Descrição</span><textarea name="description" rows="2" maxlength="240" placeholder="Explique de forma simples a responsabilidade deste cargo.">${escapeHtml(role?.description || '')}</textarea></label></div><div class="access-permissions-heading"><h4>Permissões</h4><p>Selecione apenas o necessário para o trabalho deste cargo.</p></div>${permissionFields(role?.permissions || [])}<label class="access-active-toggle"><input type="checkbox" name="active" ${role?.active === false ? '' : 'checked'}><span><strong>Cargo ativo</strong><small>Designações vinculadas só concedem acesso enquanto o cargo estiver ativo.</small></span></label><div class="form-actions"><button class="btn btn-ghost" type="button" data-access-back>Cancelar</button><button class="btn btn-primary" type="submit">Salvar cargo</button></div></form>`;
}

function userFormHtml(state, user) {
  const users = Array.isArray(state.portalUsers) ? state.portalUsers : [];
  const usedMembers = new Set(users.filter(item => item.id !== user?.id).map(item => item.memberId));
  const members = activeMembers(state).filter(member => !usedMembers.has(member.id) || member.id === user?.memberId);
  const roles = activeRoles(state);
  const current = user ? currentLeadershipRole(state, user.memberId) : { role: null, assignment: null };
  const bounds = lionYearBounds(currentLionYear());
  const roleId = current.role?.id || user?.roleId || '';
  return `<form class="access-form" id="portalUserForm"><div class="access-form-heading"><div class="access-role-icon">${uiIcon('user')}</div><div><span class="admin-eyebrow">${user ? 'Editar usuário' : 'Novo usuário'}</span><h3>${user ? escapeHtml(memberById(state, user.memberId)?.name || user.username) : 'Criar acesso individual'}</h3></div></div>
    <div class="form-grid"><label class="form-field"><span>Associado <span class="required-mark">*</span></span><select name="memberId" required ${user ? 'disabled' : ''}><option value="">Selecione</option>${members.map(member => `<option value="${escapeHtml(member.id)}" ${member.id === user?.memberId ? 'selected' : ''}>${escapeHtml(member.name)}${member.memberNumber ? ` · Nº ${escapeHtml(member.memberNumber)}` : ''}</option>`).join('')}</select>${user ? `<input type="hidden" name="memberId" value="${escapeHtml(user.memberId)}">` : ''}</label><label class="form-field"><span>Cargo vigente <span class="required-mark">*</span></span><select name="roleId" required><option value="">Selecione</option>${roles.map(role => `<option value="${escapeHtml(role.id)}" ${role.id === roleId ? 'selected' : ''}>${escapeHtml(role.name)}</option>`).join('')}</select><small>Se mudar, o cargo anterior será encerrado e mantido no histórico.</small></label><label class="form-field"><span>Início do novo cargo</span><input name="effectiveOn" type="date" min="${bounds.startsOn}" max="${bounds.endsOn}" value="${new Date().toISOString().slice(0, 10)}"><small>AL ${bounds.lionYear}</small></label><label class="form-field"><span>Nome de usuário <span class="required-mark">*</span></span><input name="username" value="${escapeHtml(user?.username || '')}" maxlength="64" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ex.: joao.augusto" required><small>Use letras, números, ponto, hífen ou sublinhado.</small></label><div class="form-field"><span>Status</span><label class="access-active-toggle is-compact"><input type="checkbox" name="active" ${user?.active === false ? '' : 'checked'}><span><strong>Usuário ativo</strong><small>Ainda exige um cargo vigente para entrar.</small></span></label></div><label class="form-field"><span>${user ? 'Nova senha' : 'Senha'} ${user ? '' : '<span class="required-mark">*</span>'}</span><input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" ${user ? 'placeholder="Deixe em branco para manter a senha atual"' : 'required'}><small>Mínimo de 10 caracteres, com letra e número.</small></label><label class="form-field"><span>Confirmar senha ${user ? '' : '<span class="required-mark">*</span>'}</span><input name="passwordConfirmation" type="password" minlength="10" maxlength="128" autocomplete="new-password" ${user ? '' : 'required'}></label></div>
    <div class="form-actions"><button class="btn btn-ghost" type="button" data-access-back>Cancelar</button><button class="btn btn-primary" type="submit">Salvar usuário</button></div>
  </form>`;
}

function assignmentFormHtml(state, assignment) {
  const roles = activeRoles(state);
  const members = activeMembers(state);
  const year = assignment?.lionYear || currentLionYear();
  const bounds = lionYearBounds(year);
  return `<form class="access-form" id="leadershipAssignmentForm"><div class="access-form-heading"><div class="access-role-icon">${uiIcon('users')}</div><div><span class="admin-eyebrow">Histórico por Ano Leonístico</span><h3>${assignment ? 'Editar designação' : 'Nova designação'}</h3></div></div>
    <div class="form-grid"><label class="form-field"><span>Associado <span class="required-mark">*</span></span><select name="memberId" required><option value="">Selecione</option>${members.map(member => `<option value="${escapeHtml(member.id)}" ${member.id === assignment?.memberId ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}</select></label><label class="form-field"><span>Cargo <span class="required-mark">*</span></span><select name="roleId" required><option value="">Selecione</option>${roles.map(role => `<option value="${escapeHtml(role.id)}" ${role.id === assignment?.roleId ? 'selected' : ''}>${escapeHtml(role.name)}</option>`).join('')}</select></label><label class="form-field"><span>Ano Leonístico <span class="required-mark">*</span></span><input name="lionYear" value="${escapeHtml(year)}" pattern="[0-9]{4}/[0-9]{4}" inputmode="numeric" autocomplete="off" placeholder="2026/2027" title="Use o formato AAAA/AAAA, por exemplo 2026/2027" required></label><label class="form-field"><span>Início <span class="required-mark">*</span></span><input name="startsOn" type="date" value="${escapeHtml(assignment?.startsOn || bounds.startsOn)}" required></label><label class="form-field"><span>Fim <span class="required-mark">*</span></span><input name="endsOn" type="date" value="${escapeHtml(assignment?.endsOn || bounds.endsOn)}" required></label><label class="form-field full-row"><span>Observação</span><textarea name="notes" rows="2" maxlength="240" placeholder="Ex.: eleito em assembleia, substituição durante o AL.">${escapeHtml(assignment?.notes || '')}</textarea></label></div>
    <label class="access-active-toggle"><input type="checkbox" name="active" ${assignment?.active === false ? '' : 'checked'}><span><strong>Designação válida</strong><small>Desative apenas para corrigir um registro sem apagar o histórico.</small></span></label>
    <div class="notice small"><strong>Permissões automáticas</strong><p>O acesso vale somente entre as datas informadas e enquanto o usuário e o cargo estiverem ativos.</p></div>
    <div class="form-actions"><button class="btn btn-ghost" type="button" data-access-back>Cancelar</button><button class="btn btn-primary" type="submit">Salvar designação</button></div>
  </form>`;
}

export function createAccessManagementController({ getState, modalController, confirmation, persist, toast, canManageUsers = () => false }) {
  if (typeof getState !== 'function') throw new TypeError('createAccessManagementController requer getState().');
  if (!modalController?.open || !modalController?.setContent) throw new TypeError('createAccessManagementController requer modalController.');

  const sectionOpenState = { roles: true, users: true, history: true };
  const yearOpenState = new Map();

  const ensureAllowed = () => {
    if (canManageUsers()) return true;
    toast('Somente o Administrador pode gerenciar usuários e cargos.');
    return false;
  };

  const renderManager = () => {
    modalController.title.textContent = 'Usuários e cargos';
    modalController.setContent(managerHtml(getState(), sectionOpenState, yearOpenState));
    bindManager();
  };

  const bindBack = () => modalController.body.querySelectorAll('[data-access-back]').forEach(button => button.addEventListener('click', renderManager));

  const openRoleForm = roleId => {
    const state = getState();
    const role = roleId ? state.accessRoles.find(item => item.id === roleId) : null;
    modalController.title.textContent = role ? 'Editar cargo' : 'Novo cargo';
    modalController.setContent(roleFormHtml(role));
    bindBack();
    const form = modalController.body.querySelector('#accessRoleForm');
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const duplicate = state.accessRoles.find(item => item.id !== role?.id && item.name.localeCompare(name, 'pt-BR', { sensitivity: 'base' }) === 0);
      if (duplicate) {
        toast('Já existe um cargo com esse nome.');
        form.elements.name.focus();
        return;
      }
      const next = { id: role?.id || uid('role'), name, description: String(data.get('description') || '').trim(), system: Boolean(role?.system), active: data.get('active') === 'on', permissions: normalizeAccessPermissions(data.getAll('permissions')) };
      if (role) Object.assign(role, next);
      else state.accessRoles.push(next);
      persist(role ? `Cargo ${name} atualizado.` : `Cargo ${name} criado.`);
      toast('Cargo salvo.');
      renderManager();
    });
  };

  const deleteRole = async roleId => {
    const state = getState();
    const role = state.accessRoles.find(item => item.id === roleId);
    if (!role || role.system) return;
    if ((state.portalUsers || []).some(user => user.roleId === roleId) || (state.leadershipAssignments || []).some(item => item.roleId === roleId)) {
      toast('Este cargo faz parte de usuários ou do histórico. Desative-o em vez de excluir.');
      return;
    }
    const approved = await confirmation.askConfirmation({ title: 'Excluir cargo?', message: `O cargo “${role.name}” será removido.`, icon: '🗑️', confirmText: 'Excluir cargo', tone: 'danger' });
    if (!approved) return;
    state.accessRoles = state.accessRoles.filter(item => item.id !== roleId);
    persist(`Cargo ${role.name} excluído.`);
    toast('Cargo excluído.');
    renderManager();
  };

  const openUserForm = userId => {
    const state = getState();
    const user = userId ? state.portalUsers.find(item => item.id === userId) : null;
    modalController.title.textContent = user ? 'Editar usuário' : 'Novo usuário';
    modalController.setContent(userFormHtml(state, user));
    bindBack();
    const form = modalController.body.querySelector('#portalUserForm');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Salvando…';
      try {
        const data = new FormData(form);
        const memberId = String(data.get('memberId') || '').trim();
        const roleId = String(data.get('roleId') || '').trim();
        const effectiveOn = String(data.get('effectiveOn') || new Date().toISOString().slice(0, 10));
        const username = normalizePortalUsername(data.get('username'));
        const password = String(data.get('password') || '');
        const confirmationValue = String(data.get('passwordConfirmation') || '');
        if (!username) throw new Error('Informe um nome de usuário válido.');
        if (state.portalUsers.some(item => item.id !== user?.id && item.username === username)) throw new Error('Este nome de usuário já está em uso.');
        if (state.portalUsers.some(item => item.id !== user?.id && item.memberId === memberId)) throw new Error('Este associado já possui um usuário individual.');
        if (!memberById(state, memberId)) throw new Error('Selecione um associado válido.');
        if (!roleById(state, roleId)) throw new Error('Selecione um cargo ativo.');
        if (!user && !password) throw new Error('Informe uma senha para o novo usuário.');
        if (password !== confirmationValue) throw new Error('A confirmação da senha não confere.');

        const id = user?.id || uid('usr');
        const passwordFields = password ? await buildPortalUserPassword(password, id) : {};
        const next = { ...(user || {}), id, memberId, roleId, username, active: data.get('active') === 'on', ...passwordFields, createdAt: user?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (user) Object.assign(user, next);
        else state.portalUsers.push(next);

        const current = currentLeadershipRole(state, memberId, effectiveOn);
        if (!current.role || current.role.id !== roleId) {
          transitionLeadershipRole(state, { id: uid('leadership'), memberId, roleId, effectiveOn, lionYear: lionYearForDate(effectiveOn), notes: user ? 'Cargo alterado no cadastro do usuário.' : 'Cargo inicial do usuário.' });
        }
        persist(user ? `Usuário ${username} atualizado.` : `Usuário ${username} criado.`);
        toast('Usuário salvo.');
        renderManager();
      } catch (error) {
        toast(error.message || 'Não foi possível salvar o usuário.');
        submit.disabled = false;
        submit.textContent = 'Salvar usuário';
      }
    });
  };

  const deleteUser = async userId => {
    const state = getState();
    const user = state.portalUsers.find(item => item.id === userId);
    if (!user) return;
    const member = memberById(state, user.memberId);
    const approved = await confirmation.askConfirmation({ title: 'Excluir usuário?', message: `O acesso de “${member?.name || user.username}” será removido. O cadastro e o histórico de cargos serão preservados.`, icon: '🗑️', confirmText: 'Excluir usuário', tone: 'danger' });
    if (!approved) return;
    state.portalUsers = state.portalUsers.filter(item => item.id !== userId);
    persist(`Usuário ${user.username} excluído.`);
    toast('Usuário excluído.');
    renderManager();
  };

  const openAssignmentForm = assignmentId => {
    const state = getState();
    const assignment = assignmentId ? state.leadershipAssignments.find(item => item.id === assignmentId) : null;
    modalController.title.textContent = assignment ? 'Editar designação' : 'Nova designação';
    modalController.setContent(assignmentFormHtml(state, assignment));
    bindBack();
    const form = modalController.body.querySelector('#leadershipAssignmentForm');
    form?.elements.lionYear?.addEventListener('change', () => {
      const bounds = lionYearBounds(form.elements.lionYear.value);
      if (!bounds.lionYear) return;
      if (!assignment) {
        form.elements.startsOn.value = bounds.startsOn;
        form.elements.endsOn.value = bounds.endsOn;
      }
    });
    form?.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const data = new FormData(form);
        const lionYear = normalizeLionYear(data.get('lionYear'));
        const next = createLeadershipAssignment({
          id: assignment?.id || uid('leadership'),
          memberId: String(data.get('memberId') || '').trim(),
          roleId: String(data.get('roleId') || '').trim(),
          lionYear,
          startsOn: String(data.get('startsOn') || ''),
          endsOn: String(data.get('endsOn') || ''),
          notes: String(data.get('notes') || ''),
          active: data.get('active') === 'on',
          now: new Date()
        });
        if (!memberById(state, next.memberId)) throw new Error('Selecione um associado válido.');
        if (!roleById(state, next.roleId)) throw new Error('Selecione um cargo ativo.');
        if (!lionYear || !assignmentDateRangeIsValid(next)) throw new Error('Confira o Ano Leonístico e as datas informadas.');
        const overlaps = overlappingLeadershipAssignments(state, next, { ignoreId: assignment?.id || '' });
        if (next.active !== false && overlaps.length) throw new Error('Este associado já possui outro cargo ativo em parte desse período.');
        if (assignment) Object.assign(assignment, next, { createdAt: assignment.createdAt || next.createdAt });
        else state.leadershipAssignments.push(next);
        persist(assignment ? 'Histórico de cargo atualizado.' : 'Cargo registrado no histórico.');
        toast('Designação salva.');
        renderManager();
      } catch (error) {
        toast(error.message || 'Não foi possível salvar a designação.');
      }
    });
  };

  function bindManager() {
    modalController.body.querySelectorAll('[data-access-toggle]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.accessToggle;
      const section = button.closest('[data-access-section]');
      const body = section?.querySelector('.access-section-body');
      const open = button.getAttribute('aria-expanded') !== 'true';
      sectionOpenState[key] = open;
      button.setAttribute('aria-expanded', String(open));
      section?.classList.toggle('is-open', open);
      if (body) body.hidden = !open;
    }));
    modalController.body.querySelectorAll('[data-access-year-toggle]').forEach(button => button.addEventListener('click', () => {
      const lionYear = button.dataset.accessYearToggle;
      const group = button.closest('[data-leadership-year]');
      const list = group?.querySelector('.leadership-history-list');
      const open = button.getAttribute('aria-expanded') !== 'true';
      yearOpenState.set(lionYear, open);
      button.setAttribute('aria-expanded', String(open));
      group?.classList.toggle('is-open', open);
      if (list) list.hidden = !open;
    }));
    modalController.body.querySelector('#createAccessRoleBtn')?.addEventListener('click', () => openRoleForm());
    modalController.body.querySelector('#createPortalUserBtn')?.addEventListener('click', () => openUserForm());
    modalController.body.querySelector('#createLeadershipAssignmentBtn')?.addEventListener('click', () => openAssignmentForm());
    modalController.body.querySelectorAll('[data-access-edit-role]').forEach(button => button.addEventListener('click', () => openRoleForm(button.dataset.accessEditRole)));
    modalController.body.querySelectorAll('[data-access-delete-role]').forEach(button => button.addEventListener('click', () => deleteRole(button.dataset.accessDeleteRole)));
    modalController.body.querySelectorAll('[data-access-edit-user]').forEach(button => button.addEventListener('click', () => openUserForm(button.dataset.accessEditUser)));
    modalController.body.querySelectorAll('[data-access-delete-user]').forEach(button => button.addEventListener('click', () => deleteUser(button.dataset.accessDeleteUser)));
    modalController.body.querySelectorAll('[data-access-edit-assignment]').forEach(button => button.addEventListener('click', () => openAssignmentForm(button.dataset.accessEditAssignment)));
  }

  const open = () => {
    if (!ensureAllowed()) return;
    modalController.open('Usuários e cargos', managerHtml(getState(), sectionOpenState, yearOpenState));
    bindManager();
  };

  return Object.freeze({ open });
}
