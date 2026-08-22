import { escapeHtml, money, normalize, uid } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.52.0';

export function createTreasuryAccountsManager(context) {
  const {
    state,
    treasury,
    modalBody,
    showModal,
    confirmation,
    persist,
    toast
  } = context;

  const openTreasuryAccountsManager = (editAccountId = '') => {
    const accounts = treasury.accounts();
    const editing = accounts.find(account => account.id === editAccountId) || null;
    const activeAccounts = accounts.filter(account => account.active !== false);
    const typeOptions = ['Conta corrente', 'Aplicação', 'Dinheiro em caixa', 'Poupança', 'Outra'];
    if (editing?.type && !typeOptions.includes(editing.type)) typeOptions.push(editing.type);

    modalBody.innerHTML = `<div class="accounts-manager treasury-catalog-manager">
      <div class="catalog-manager-heading"><div><span class="section-eyebrow">Cadastro financeiro</span><h3>Contas da Tesouraria</h3><p>Crie, edite, ative ou desative as contas utilizadas nos lançamentos.</p></div></div>
      <div class="accounts-manager-list">${accounts.map(account => {
        const usageCount = state().treasury.filter(item => item.accountId === account.id).length;
        return `<article class="account-manager-row ${account.active === false ? 'is-inactive' : ''}"><span>${treasury.accountTypeIcon(account.type)}</span><div><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.type || 'Conta')} · Saldo inicial ${money.format(Number(account.initialBalance || 0))} · ${usageCount} lançamento(s)</small><span class="catalog-status ${account.active === false ? 'is-inactive' : 'is-active'}">${account.active === false ? 'Inativa' : 'Ativa'}</span>${account.active !== false && account.membershipDefault === true ? '<span class="catalog-status is-active">Padrão mensalidades</span>' : ''}</div><div class="catalog-row-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-account="${escapeHtml(account.id)}">Editar</button><button class="btn btn-ghost btn-sm" type="button" data-toggle-account="${escapeHtml(account.id)}">${account.active === false ? 'Ativar' : 'Desativar'}</button><button class="btn btn-danger-soft btn-sm" type="button" data-remove-account="${escapeHtml(account.id)}" ${usageCount ? 'disabled title="A conta possui lançamentos vinculados."' : ''}>Excluir</button></div></article>`;
      }).join('')}</div>
      <form id="accountManagerForm" class="admin-entity-form catalog-editor-form">
        <input type="hidden" name="accountId" value="${escapeHtml(editing?.id || '')}">
        <section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon(editing ? 'edit' : 'plus')}</span><div><h3>${editing ? 'Editar conta' : 'Adicionar conta'}</h3><p>Informe os dados usados na identificação e nos saldos.</p></div></div><div class="form-grid admin-form-section-grid"><div class="form-field"><label>Nome *</label><input name="name" required value="${escapeHtml(editing?.name || '')}" placeholder="Ex.: Conta corrente Sicredi"></div><div class="form-field"><label>Tipo *</label><select name="type" required>${typeOptions.map(type => `<option ${editing?.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select></div><div class="form-field"><label>Saldo inicial (R$)</label><input name="initialBalance" type="number" step="0.01" value="${Number(editing?.initialBalance || 0)}"></div><div class="form-field catalog-active-field"><label><input name="active" type="checkbox" ${editing?.active === false ? '' : 'checked'}> Conta ativa</label><small>Contas inativas não aparecem em novos lançamentos.</small></div><div class="form-field catalog-active-field full-row"><label><input name="membershipDefault" type="checkbox" ${editing?.membershipDefault === true ? 'checked' : ''}> Conta padrão para receber mensalidades</label><small>Ao dar baixa em mensalidades, esta conta será pré-selecionada. Apenas uma conta ativa pode ser a padrão.</small></div></div></section><div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Fechar</button>${editing ? '<button type="button" class="btn btn-ghost" id="cancelAccountEdit">Cancelar edição</button>' : ''}<button class="btn btn-primary" type="submit">${editing ? 'Salvar conta' : 'Adicionar conta'}</button></div>
      </form>
    </div>`;
    showModal('Contas da Tesouraria');

    const form = document.getElementById('accountManagerForm');
    form.onsubmit = event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const name = String(data.name || '').trim();
      const type = String(data.type || 'Conta').trim();
      const active = form.elements.active.checked;
      const membershipDefault = form.elements.membershipDefault.checked;
      const duplicate = accounts.find(account => account.id !== data.accountId && normalize(account.name) === normalize(name));
      if (duplicate) {
        toast('Já existe uma conta com esse nome.');
        return;
      }
      if (!active && activeAccounts.length <= 1 && editing?.active !== false) {
        toast('Mantenha ao menos uma conta ativa.');
        return;
      }
      if (membershipDefault && !active) {
        toast('A conta padrão para mensalidades precisa estar ativa.');
        return;
      }
      if (membershipDefault) accounts.forEach(account => { account.membershipDefault = false; });

      const payload = {
        id: data.accountId || uid('a'),
        name,
        type,
        initialBalance: Number(data.initialBalance || 0),
        active,
        membershipDefault: active && membershipDefault
      };
      if (editing) Object.assign(editing, payload);
      else accounts.push(payload);
      persist(editing ? 'Conta atualizada.' : 'Conta adicionada.');
      openTreasuryAccountsManager();
    };

    document.getElementById('cancelAccountEdit')?.addEventListener('click', () => openTreasuryAccountsManager());
    modalBody.querySelectorAll('[data-edit-account]').forEach(button => {
      button.onclick = () => openTreasuryAccountsManager(button.dataset.editAccount);
    });
    modalBody.querySelectorAll('[data-toggle-account]').forEach(button => {
      button.onclick = () => {
        const account = accounts.find(item => item.id === button.dataset.toggleAccount);
        if (!account) return;
        if (account.active !== false && activeAccounts.length <= 1) {
          toast('Mantenha ao menos uma conta ativa.');
          return;
        }
        account.active = account.active === false;
        if (account.active === false) account.membershipDefault = false;
        persist(account.active ? 'Conta ativada.' : 'Conta desativada.');
        openTreasuryAccountsManager();
      };
    });
    modalBody.querySelectorAll('[data-remove-account]').forEach(button => {
      button.onclick = async () => {
        const account = accounts.find(item => item.id === button.dataset.removeAccount);
        if (!account) return;
        const usageCount = state().treasury.filter(item => item.accountId === account.id).length;
        if (usageCount) {
          toast('Esta conta possui lançamentos e não pode ser excluída. Desative-a.');
          return;
        }
        if (accounts.length <= 1 || (account.active !== false && activeAccounts.length <= 1)) {
          toast('Mantenha ao menos uma conta ativa.');
          return;
        }
        const approved = await confirmation.askConfirmation({
          title: 'Excluir conta?',
          message: `A conta “${account.name}” será removida do cadastro.`,
          icon: 'bank',
          confirmText: 'Excluir conta',
          tone: 'danger'
        });
        if (!approved) return;
        state().treasuryAccounts = accounts.filter(item => item.id !== account.id);
        persist('Conta excluída.');
        openTreasuryAccountsManager();
      };
    });
  };

  return openTreasuryAccountsManager;
}
