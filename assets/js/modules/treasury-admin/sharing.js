import { escapeHtml, money } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.13';
import { buildFamilyMembershipChargeMessage, buildMembershipChargeMessage } from './domain.js';
import { blobToDataUrl, buildChargeSvg, downloadBlob, svgMarkupToDataUrl, svgToPngBlob } from './sharing-image-utils.js';
export function createMembershipChargeSharer(context) {
  const {
    state,
    treasury,
    toast,
    modalBody,
    showModal,
    closeModal
  } = context;
  const assetCache = new Map();
  const fetchAssetAsDataUrl = async assetPath => {
    const path = String(assetPath || '').trim();
    if (!path) return '';
    if (assetCache.has(path)) return assetCache.get(path);
    const promise = fetch(new URL(path, window.location.href))
      .then(response => {
        if (!response.ok) throw new Error(`Falha ao carregar ativo: ${path}`);
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch(() => '');
    assetCache.set(path, promise);
    return promise;
  };
  const copyTextToClipboard = async text => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast('Mensagem copiada para a área de transferência. Agora é só colar no WhatsApp.');
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    toast('Mensagem copiada para a área de transferência. Agora é só colar no WhatsApp.');
    return true;
  };
  const shareImagePayload = async (payload, svgMarkup, width, height) => {
    const pngBlob = await svgToPngBlob(svgMarkup, width, height);
    const shareFile = typeof File === 'function'
      ? new File([pngBlob], payload.filename, { type: 'image/png' })
      : null;
    if (navigator.share && shareFile && (!navigator.canShare || navigator.canShare({ files: [shareFile] }))) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          files: [shareFile]
        });
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return false;
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: payload.title, text: payload.text });
        downloadBlob(pngBlob, payload.filename);
        toast('Texto compartilhado. O PNG também foi baixado para você anexar no WhatsApp.');
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return false;
      }
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload.text);
    }
    downloadBlob(pngBlob, payload.filename);
    toast('Imagem baixada e texto copiado. Agora é só anexar o PNG no WhatsApp.');
    return true;
  };
  const buildIndividualPayload = async (member, months, clubName) => {
    const monthDebts = months.map(month => ({ month, amount: treasury.membershipOutstandingForMonth(member.id, month) }))
      .filter(item => item.amount > 0.005);
    const openingDebt = treasury.membershipOpeningDebtOutstanding(member.id);
    const monthlyFee = treasury.membershipExpectedAmountForMember(member.id);
    const periodOutstanding = monthDebts.reduce((sum, item) => sum + item.amount, 0);
    const expectedTotal = openingDebt + periodOutstanding;
    const [avatarDataUrl, clubLogoDataUrl] = await Promise.all([
      fetchAssetAsDataUrl(member.photo),
      fetchAssetAsDataUrl('./public/logo.png')
    ]);
    return {
      title: `Mensalidade — ${clubName}`,
      text: buildMembershipChargeMessage({
        memberName: member.name,
        monthLabels: monthDebts.map(item => treasury.monthLabel(item.month)),
        expectedTotal,
        openingDebt,
        monthlyFee,
        periodOutstanding,
        clubName
      }),
      image: {
        variant: 'individual',
        clubName,
        clubLogoDataUrl,
        title: 'Mensalidades',
        subtitle: 'Associado',
        responsibleLabel: 'Associado',
        responsibleName: member.name,
        responsibleAvatar: avatarDataUrl,
        badgeLabel: 'Associado',
        linkedMembers: [],
        summaryStats: [
          {
            label: 'Mensalidade',
            detail: monthlyFee > 0
              ? `${money.format(monthlyFee)} x ${monthDebts.length} ${monthDebts.length === 1 ? 'mês' : 'meses'}`
              : 'Sem competências no período',
            hint: `Saldo do período: ${money.format(periodOutstanding)}${openingDebt > 0.005 ? ` · saldo anterior: ${money.format(openingDebt)}` : ''}`,
            amount: expectedTotal
          }
        ],
        rows: [
          ...(openingDebt > 0.005 ? [{ label: 'Saldo anterior', amount: openingDebt }] : []),
          ...monthDebts.map(item => ({ label: treasury.monthLabel(item.month), amount: item.amount }))
        ],
        totalLabel: 'Total',
        total: expectedTotal,
        note: 'Resumo das competências selecionadas.',
        footer: ''
      },
      filename: `cobranca-individual-${String(member.name || 'associado').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'associado'}.png`
    };
  };
  const buildFamilySelectionState = (group, requestedMonths) => {
    const entries = (group?.memberIds || [])
      .map(id => state().birthdays.find(item => item.id === id))
      .filter(item => item && treasury.memberIsActive(item))
      .map(member => {
        const pendingMonths = requestedMonths.filter(month => !treasury.monthIsPaid(member.id, month));
        const openingDebt = treasury.membershipOpeningDebtOutstanding(member.id);
        const total = openingDebt + pendingMonths.reduce((sum, month) => sum + treasury.membershipOutstandingForMonth(member.id, month), 0);
        return {
          id: member.id,
          name: member.name,
          isPrimary: member.id === group.primaryMemberId,
          pendingMonths,
          pendingCount: pendingMonths.length,
          openingDebt,
          total,
          selected: total > 0.005
        };
      });
    return entries.filter(item => item.total > 0.005);
  };
  const buildFamilyPayload = async (group, requestedMonths, clubName, selectedMemberIds = null) => {
    const selectedSet = Array.isArray(selectedMemberIds) && selectedMemberIds.length ? new Set(selectedMemberIds) : null;
    const members = (group.memberIds || [])
      .map(id => state().birthdays.find(item => item.id === id))
      .filter(item => item && treasury.memberIsActive(item) && (!selectedSet || selectedSet.has(item.id)));
    const pendingCharges = members.flatMap(member => {
      const pendingMonths = requestedMonths.filter(month => !treasury.monthIsPaid(member.id, month));
      return pendingMonths.map(month => ({
        member,
        month,
        amount: treasury.membershipOutstandingForMonth(member.id, month)
      }));
    });
    const memberCharges = members.map(member => {
      const pendingMonths = requestedMonths.filter(month => !treasury.monthIsPaid(member.id, month));
      const openingDebt = treasury.membershipOpeningDebtOutstanding(member.id);
      const periodOutstanding = pendingMonths.reduce((sum, month) => sum + treasury.membershipOutstandingForMonth(member.id, month), 0);
      return {
        memberId: member.id,
        memberName: member.name,
        role: member.id === group.primaryMemberId ? 'Titular' : 'Familiar',
        monthLabels: pendingMonths.map(treasury.monthLabel),
        openingDebt,
        monthlyFee: treasury.membershipExpectedAmountForMember(member.id),
        periodOutstanding,
        expectedTotal: openingDebt + periodOutstanding
      };
    }).filter(item => item.monthLabels.length || item.openingDebt > 0.005);
    const clubLogoDataUrl = await fetchAssetAsDataUrl('./public/logo.png');
    const chargeMembers = await Promise.all(members.map(async member => ({
      name: member.name,
      role: member.id === group.primaryMemberId ? 'Titular' : 'Familiar',
      avatar: await fetchAssetAsDataUrl(member.photo)
    })));
    const responsibleMember = members.find(member => member.id === group.primaryMemberId) || members[0] || null;
    const responsibleAvatar = responsibleMember ? await fetchAssetAsDataUrl(responsibleMember.photo) : '';
    const total = memberCharges.reduce((sum, item) => sum + Number(item.expectedTotal || 0), 0);
    const titularCharges = pendingCharges.filter(item => item.member.id === group.primaryMemberId);
    const titularOpeningDebt = group.primaryMemberId ? treasury.membershipOpeningDebtOutstanding(group.primaryMemberId) : 0;
    const titularMonthlyTotal = titularCharges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const titularTotal = titularOpeningDebt + titularMonthlyTotal;
    const titularInstallments = titularCharges.length;
    const titularMonthlyFee = group.primaryMemberId ? treasury.membershipExpectedAmountForMember(group.primaryMemberId) : 0;
    const familyCharges = pendingCharges.filter(item => item.member.id !== group.primaryMemberId);
    const familyMembers = members.filter(member => member.id !== group.primaryMemberId);
    const familyOpeningDebt = familyMembers.reduce((sum, member) => sum + treasury.membershipOpeningDebtOutstanding(member.id), 0);
    const familyMonthlyTotal = familyCharges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const familyMembersTotal = familyOpeningDebt + familyMonthlyTotal;
    const familyInstallments = familyCharges.length;
    const familyMembersCount = familyMembers.length;
    const familyMonthlyFee = familyMembers[0] ? treasury.membershipExpectedAmountForMember(familyMembers[0].id) : 0;
    const monthTotals = requestedMonths.map(month => ({
      month,
      label: treasury.monthLabel(month),
      amount: pendingCharges
        .filter(item => item.month === month)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    })).filter(item => item.amount > 0);
    return {
      memberCharges,
      title: `Mensalidades da ${group.name} — ${clubName}`,
      text: buildFamilyMembershipChargeMessage({
        familyName: group.name,
        memberCharges: memberCharges.map(({ memberName, role, monthLabels, openingDebt, expectedTotal, monthlyFee, periodOutstanding }) => ({ memberName, role, monthLabels, openingDebt, expectedTotal, monthlyFee, periodOutstanding })),
        clubName
      }),
      image: {
        variant: 'family',
        clubName,
        clubLogoDataUrl,
        title: 'Mensalidades',
        subtitle: 'Grupo familiar',
        responsibleLabel: 'Responsável',
        responsibleName: responsibleMember?.name || group.name,
        responsibleAvatar,
        badgeLabel: 'Grupo familiar',
        linkedMembers: chargeMembers,
        summaryStats: [
          {
            label: 'Titular',
            detail: titularInstallments
              ? `${money.format(titularMonthlyFee)} x ${titularInstallments} ${titularInstallments === 1 ? 'mensalidade' : 'mensalidades'}`
              : titularOpeningDebt > 0.005 ? 'Sem competências no período' : 'Sem pendências',
            hint: titularTotal > 0.005
              ? `Saldo do período: ${money.format(titularMonthlyTotal)}${titularOpeningDebt > 0.005 ? ` · saldo anterior: ${money.format(titularOpeningDebt)}` : ''}`
              : 'Nenhum saldo em aberto',
            amount: titularTotal
          },
          {
            label: 'Família',
            detail: familyInstallments
              ? `${money.format(familyMonthlyFee)} x ${familyInstallments} ${familyInstallments === 1 ? 'mensalidade' : 'mensalidades'}`
              : familyOpeningDebt > 0.005 ? 'Sem competências no período' : 'Sem pendências',
            hint: familyMembersCount
              ? `${familyMembersCount} ${familyMembersCount === 1 ? 'integrante' : 'integrantes'} · saldo do período: ${money.format(familyMonthlyTotal)}${familyOpeningDebt > 0.005 ? ` · saldo anterior: ${money.format(familyOpeningDebt)}` : ''}`
              : 'Nenhum integrante adicional selecionado',
            amount: familyMembersTotal
          }
        ],
        tableTitle: 'Valores mensais consolidados',
        rows: [
          ...(memberCharges.reduce((sum, item) => sum + item.openingDebt, 0) > 0.005
            ? [{ label: 'Saldo anterior', amount: memberCharges.reduce((sum, item) => sum + item.openingDebt, 0) }]
            : []),
          ...monthTotals.map(item => ({ label: item.label, amount: item.amount }))
        ],
        totalLabel: 'Total familiar',
        total,
        note: 'Resumo das competências selecionadas.',
        footer: ''
      },
      filename: `cobranca-familiar-${String(group.name || 'familia').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'familia'}.png`
    };
  };
  const openImagePreview = async ({ payloadPromise, optionLabel, back }) => {
    modalBody.innerHTML = `<section class="membership-charge-preview-shell"><div class="membership-charge-preview-loading">${uiIcon('image')}<strong>Gerando prévia da imagem</strong><small>Montando a cobrança visual de ${escapeHtml(optionLabel)}…</small></div></section>`;
    showModal('Prévia da cobrança');
    try {
      const payload = await payloadPromise;
      const svg = buildChargeSvg(payload.image);
      const svgDataUrl = svgMarkupToDataUrl(svg.markup);
      modalBody.innerHTML = `<section class="membership-charge-preview-shell" aria-labelledby="membershipChargePreviewTitle">
        <div class="membership-charge-preview-toolbar">
          <div>
            <span class="admin-eyebrow">Imagem da cobrança</span>
            <h3 id="membershipChargePreviewTitle">Prévia pronta para compartilhamento</h3>
            <p>${escapeHtml(optionLabel)} · revise, compartilhe no aparelho/WhatsApp ou baixe a imagem em PNG.</p>
          </div>
          <div class="membership-charge-preview-actions">
            <button class="btn btn-ghost" type="button" data-membership-preview-back>← Voltar para opções</button>
            <button class="btn btn-ghost" type="button" data-membership-preview-share>${uiIcon('upload')} Compartilhar</button>
            <button class="btn btn-primary" type="button" data-membership-preview-download>${uiIcon('download')} Baixar PNG</button>
          </div>
        </div>
        <div class="membership-charge-preview-stage">
          <img class="membership-charge-preview-image" src="${svgDataUrl}" alt="Prévia da cobrança em imagem" width="${svg.width}" height="${svg.height}">
        </div>
      </section>`;
      modalBody.querySelector('[data-membership-preview-back]')?.addEventListener('click', back);
      modalBody.querySelector('[data-membership-preview-share]')?.addEventListener('click', async () => {
        try {
          await shareImagePayload(payload, svg.markup, svg.width, svg.height);
        } catch (error) {
          console.error(error);
          toast('Não foi possível compartilhar a imagem da cobrança.');
        }
      });
      modalBody.querySelector('[data-membership-preview-download]')?.addEventListener('click', async () => {
        try {
          const pngBlob = await svgToPngBlob(svg.markup, svg.width, svg.height);
          downloadBlob(pngBlob, payload.filename);
          toast('Imagem da cobrança gerada com sucesso.');
        } catch (error) {
          console.error(error);
          toast('Não foi possível gerar o PNG da cobrança.');
        }
      });
    } catch (error) {
      console.error(error);
      modalBody.innerHTML = `<section class="membership-charge-preview-shell"><div class="membership-charge-preview-loading is-error">${uiIcon('warning')}<strong>Não foi possível gerar a prévia</strong><small>Tente novamente em alguns instantes.</small><div class="form-actions"><button class="btn btn-ghost" type="button" data-membership-preview-back>Voltar</button></div></div></section>`;
      modalBody.querySelector('[data-membership-preview-back]')?.addEventListener('click', back);
    }
  };
  // Targets renderizados neste fluxo: data-membership-charge-target="member" e data-membership-charge-target="family".
  const renderOptionCard = ({ type, title, detail, helper, value, icon, style = '' }) => `<article class="membership-charge-option ${style}" data-membership-card="${type}">
      <div class="membership-charge-option-summary">
        <span class="membership-charge-option-icon" aria-hidden="true">${uiIcon(icon)}</span>
        <div class="membership-charge-option-copy">
          <span class="membership-charge-option-kicker">Cobrança</span>
          <strong>${escapeHtml(title)}</strong>
          <small class="membership-charge-option-detail">${escapeHtml(detail)}</small>
        </div>
      </div>
      <p class="membership-charge-option-helper">${escapeHtml(helper || 'Escolha como deseja compartilhar esta cobrança.')}</p>
      <div class="membership-charge-option-total">
        <span>Total previsto</span>
        <b>${escapeHtml(value)}</b>
      </div>
      <div class="membership-charge-option-actions">
        <button class="btn btn-ghost" type="button" data-membership-charge-action="text" data-membership-charge-target="${type}">${uiIcon('message')} Copiar mensagem</button>
        <button class="btn btn-primary" type="button" data-membership-charge-action="image" data-membership-charge-target="${type}">${uiIcon('image')} Gerar imagem</button>
      </div>
    </article>`;
  const openFamilySelectionModal = ({ group, requestedMonths, clubName, action, back, memberPayloadPromise, memberSummary, familySummary }) => {
    const entries = buildFamilySelectionState(group, requestedMonths);
    if (!entries.length) {
      toast('Nenhum familiar possui mensalidades pendentes neste período.');
      back();
      return;
    }
    const render = () => {
      const selectedCount = entries.filter(item => item.selected).length;
      modalBody.innerHTML = `<section class="membership-charge-selector" aria-labelledby="membershipChargeSelectorTitle">
        <div class="membership-charge-choice-intro"><span aria-hidden="true">${uiIcon('family')}</span><div><h3 id="membershipChargeSelectorTitle">Quem fará parte desta cobrança?</h3><p>Selecione os associados/familiares que devem compor a cobrança compartilhada.</p></div></div>
        <div class="membership-charge-selector-list">${entries.map(item => `<label class="membership-charge-selector-item ${item.selected ? 'is-selected' : ''} ${item.isPrimary ? 'is-primary' : ''}">
            <input type="checkbox" data-membership-family-member value="${escapeHtml(item.id)}" ${item.selected ? 'checked' : ''}>
            <span class="membership-charge-selector-copy">
              <strong>${escapeHtml(item.name)}</strong>
              <small>${item.isPrimary ? 'Titular' : 'Familiar'} · ${item.pendingCount} ${item.pendingCount === 1 ? 'competência' : 'competências'}${item.openingDebt > 0.005 ? ' + saldo anterior' : ''} · saldo ${escapeHtml(money.format(item.total))}</small>
            </span>
          </label>`).join('')}</div>
        <div class="membership-charge-selector-footer">
          <small>${selectedCount} participante(s) selecionado(s)</small>
          <div class="form-actions">
            <button class="btn btn-ghost" type="button" data-membership-selector-back>Voltar</button>
            <button class="btn btn-primary" type="button" data-membership-selector-confirm ${selectedCount ? '' : 'disabled'}>Continuar</button>
          </div>
        </div>
      </section>`;
      showModal('Selecionar participantes');
      modalBody.querySelectorAll('[data-membership-family-member]').forEach(input => {
        input.addEventListener('change', event => {
          const targetId = event.currentTarget.value;
          const entry = entries.find(item => item.id === targetId);
          if (entry) entry.selected = event.currentTarget.checked;
          render();
        });
      });
      modalBody.querySelector('[data-membership-selector-back]')?.addEventListener('click', back);
      modalBody.querySelector('[data-membership-selector-confirm]')?.addEventListener('click', async () => {
        const selectedIds = entries.filter(item => item.selected).map(item => item.id);
        if (!selectedIds.length) {
          toast('Selecione pelo menos um participante.');
          return;
        }
        const familyPayloadPromise = buildFamilyPayload(group, requestedMonths, clubName, selectedIds);
        if (action === 'text') {
          closeModal();
          const payload = await familyPayloadPromise;
          await copyTextToClipboard(payload.text);
          return;
        }
        openImagePreview({
          payloadPromise: familyPayloadPromise,
          optionLabel: 'grupo familiar selecionado',
          back: () => openFamilySelectionModal({ group, requestedMonths, clubName, action, back, memberPayloadPromise, memberSummary, familySummary })
        });
      });
    };
    render();
  };
  const openChoiceModal = ({ memberPayloadPromise, familyPayloadPromise = null, memberSummary, familySummary = null }) => {
    const cards = [renderOptionCard({
      type: 'member',
      title: 'Somente o associado',
      detail: memberSummary.detail,
      helper: memberSummary.helper,
      value: money.format(memberSummary.total),
      icon: 'user'
    })];
    if (familySummary) {
      cards.push(renderOptionCard({
        type: 'family',
        title: 'Toda a família',
        detail: familySummary.detail,
        helper: familySummary.helper,
        value: money.format(familySummary.total),
        icon: 'family',
        style: 'is-family'
      }));
    }
    modalBody.innerHTML = `<section class="membership-charge-choice" aria-labelledby="membershipChargeChoiceTitle">
      <div class="membership-charge-choice-intro"><span aria-hidden="true">${uiIcon('message')}</span><div><h3 id="membershipChargeChoiceTitle">Como deseja compartilhar a cobrança?</h3><p>Escolha para quem enviar a cobrança e como deseja compartilhar: mensagem pronta para WhatsApp ou imagem personalizada.</p></div></div>
      <div class="membership-charge-choice-grid">${cards.join('')}</div>
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button></div>
    </section>`;
    showModal('Enviar cobrança');
    modalBody.querySelectorAll('[data-membership-charge-action]').forEach(button => {
      button.addEventListener('click', async event => {
        const target = event.currentTarget.dataset.membershipChargeTarget;
        const action = event.currentTarget.dataset.membershipChargeAction;
        if (target === 'family' && familyPayloadPromise) {
          openFamilySelectionModal({
            group: familySummary.group,
            requestedMonths: familySummary.requestedMonths,
            clubName: familySummary.clubName,
            action,
            back: () => openChoiceModal({ memberPayloadPromise, familyPayloadPromise, memberSummary, familySummary }),
            memberPayloadPromise,
            memberSummary,
            familySummary
          });
          return;
        }
        const payloadPromise = memberPayloadPromise;
        if (action === 'text') {
          closeModal();
          const payload = await payloadPromise;
          await copyTextToClipboard(payload.text);
          return;
        }
        openImagePreview({
          payloadPromise,
          optionLabel: 'somente o associado',
          back: () => openChoiceModal({ memberPayloadPromise, familyPayloadPromise, memberSummary, familySummary })
        });
      });
    });
  };
  return async (memberId, months = [], periodMonths = months) => {
    const member = state().birthdays.find(item => item.id === memberId);
    if (!member) {
      toast('Associado não encontrado.');
      return;
    }
    const pendingMonths = [...new Set(months)].filter(Boolean);
    const filteredPeriodMonths = [...new Set(periodMonths)].filter(Boolean);
    const familyRequestedMonths = filteredPeriodMonths.length ? filteredPeriodMonths : pendingMonths;
    const memberOpeningDebt = treasury.membershipOpeningDebtOutstanding(memberId);
    if (!pendingMonths.length && memberOpeningDebt <= 0.005) {
      toast('Não há mensalidades ou saldo anterior pendente para cobrança.');
      return;
    }
    const clubName = state().settings?.clubName || 'Lions Clube';
    const memberPayloadPromise = buildIndividualPayload(member, pendingMonths, clubName);
    const group = treasury.familyGroupForMember(memberId);
    if (!group) {
      openChoiceModal({
        memberPayloadPromise,
        memberSummary: {
          total: memberOpeningDebt + pendingMonths.reduce((sum, month) => sum + treasury.membershipOutstandingForMonth(memberId, month), 0),
          detail: member.name,
          helper: `${pendingMonths.length} mês(es) pendente(s)${memberOpeningDebt > 0.005 ? ' + saldo anterior' : ''}`
        }
      });
      return;
    }
    const familyPayload = await buildFamilyPayload(group, familyRequestedMonths, clubName);
    openChoiceModal({
      memberPayloadPromise,
      familyPayloadPromise: familyPayload.memberCharges.length ? Promise.resolve(familyPayload) : null,
      memberSummary: {
        total: memberOpeningDebt + pendingMonths.reduce((sum, month) => sum + treasury.membershipOutstandingForMonth(memberId, month), 0),
        detail: member.name,
        helper: `${pendingMonths.length} mês(es) pendente(s)${memberOpeningDebt > 0.005 ? ' + saldo anterior' : ''}`
      },
      familySummary: familyPayload.memberCharges.length ? {
        total: familyPayload.memberCharges.reduce((sum, item) => sum + Number(item.expectedTotal || 0), 0),
        detail: group.name,
        helper: `${familyPayload.memberCharges.length} integrante(s) · ${familyPayload.image.rows.length} item(ns) em aberto`,
        group,
        requestedMonths: familyRequestedMonths,
        clubName
      } : null
    });
  };
}
