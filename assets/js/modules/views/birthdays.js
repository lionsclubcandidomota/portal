import { els, icon, normalize, avatar, escapeHtml, empty } from '../core.js';
import { currentMonthBirthdays, birthdayStatus, birthdayDateText, birthdayRelativeDays } from '../model.js';

export function renderBirthdays() {
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  els.root.innerHTML = `
    <section class="section-banner birthdays-banner">
      <div><h2>${icon('cake')} Aniversários de ${month}</h2><p>Por privacidade, o portal público exibe somente dia e mês.</p></div>
      <div class="search-row">
        <label class="search">${icon('search')}<input id="birthdaySearch" type="search" placeholder="Pesquisar pelo nome…" aria-label="Pesquisar aniversariantes"></label>
        <span class="month-chip">${icon('calendar')} ${month}</span>
      </div>
    </section>
    <div id="birthdayResults"></div>`;

  const input = document.getElementById('birthdaySearch');
  const draw = () => {
    const query = normalize(input.value);
    const items = currentMonthBirthdays().filter(person => normalize(person.name).includes(query));

    const rows = items.map(person => {
      const status = birthdayStatus(person);
      return `<tr>
        <td><div class="birthday-person">${avatar(person)}<strong>${escapeHtml(person.name)}</strong></div></td>
        <td class="birthday-date">${escapeHtml(birthdayDateText(person))}</td>
        <td><div class="birthday-status-actions"><span class="birthday-status ${status.cls}">${escapeHtml(status.text)}</span>${birthdayRelativeDays(person) === 0 ? `<button class="btn btn-primary" type="button" data-birthday-share="${escapeHtml(person.id)}">${icon('cake')} Enviar parabéns</button>` : ''}</div></td>
      </tr>`;
    }).join('');

    const cards = items.map(person => {
      const status = birthdayStatus(person);
      return `<article class="birthday-card">
        <div class="birthday-card-head">
          ${avatar(person)}
          <div class="birthday-card-copy"><h3>${escapeHtml(person.name)}</h3><div class="birthday-card-date">${icon('calendar')}<strong>${escapeHtml(birthdayDateText(person))}</strong></div></div>
          <span class="birthday-status ${status.cls}">${escapeHtml(status.text)}</span>
        </div>
        ${birthdayRelativeDays(person) === 0 ? `<div class="birthday-card-actions"><button class="btn btn-primary" type="button" data-birthday-share="${escapeHtml(person.id)}">${icon('cake')} Enviar parabéns</button></div>` : ''}
      </article>`;
    }).join('');

    document.getElementById('birthdayResults').innerHTML = items.length
      ? `<div class="card birthdays-table"><table><thead><tr><th>Pessoa</th><th>Aniversário</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table></div><div class="birthday-cards">${cards}</div>`
      : empty('Nenhum aniversariante encontrado neste mês.');
  };

  input.addEventListener('input', draw);
  draw();
}
