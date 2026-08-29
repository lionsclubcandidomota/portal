import { state, els, normalize, escapeHtml, avatar, empty } from '../core.js';

function currentLionYear(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

function leaderYears() {
  return [...new Set(state.data.leaders.map(leader => leader.lionYear).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}

function rolePriority(name = '') {
  const normalized = normalize(name);
  const roles = ['presidente', 'vice presidente', 'secret', 'tesour', 'diretor'];
  const index = roles.findIndex(role => normalized.includes(role));
  return index < 0 ? 99 : index;
}

export function renderLeaders(selectedYear = '') {
  const years = leaderYears();
  const current = currentLionYear();
  const year = selectedYear || (years.includes(current) ? current : years[0] || current);
  const leaders = state.data.leaders
    .filter(leader => leader.lionYear === year)
    .sort((a, b) => rolePriority(a.role) - rolePriority(b.role) || a.role.localeCompare(b.role, 'pt-BR'));

  els.root.innerHTML = `
    <section class="leaders-hero">
      <div><span class="hero-eyebrow">Diretoria do clube</span><h2>Dirigentes do AL ${escapeHtml(year)}</h2><p>Conheça as pessoas responsáveis pela condução do clube neste Ano Leonístico.</p></div>
      ${years.length ? `<label><span class="sr-only">Ano Leonístico</span><select id="leaderYear" aria-label="Selecionar Ano Leonístico">${years.map(item => `<option value="${escapeHtml(item)}" ${item === year ? 'selected' : ''}>AL ${escapeHtml(item)}${item === current ? ' · Atual' : ''}</option>`).join('')}</select></label>` : ''}
    </section>
    <section class="leaders-grid">${leaders.length ? leaders.map((leader, index) => `<article class="leader-card ${index === 0 ? 'featured' : ''}">${avatar(leader, 'leader-photo')}<span class="leader-role">${escapeHtml(leader.role)}</span><h3>${escapeHtml(leader.name)}</h3><p>${year === current ? 'Dirigente atual' : `Dirigente no AL ${escapeHtml(year)}`}</p></article>`).join('') : empty('Os dirigentes deste Ano Leonístico ainda não foram publicados.')}</section>`;

  document.getElementById('leaderYear')?.addEventListener('change', event => renderLeaders(event.target.value));
}
