import { state, normalize, parseLocalDate, todayStart, dateKey } from './core.js';

export function birthdayParts(person) {
  const match = String(person.birthday || '').match(/^(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { month: Number(match[1]) - 1, day: Number(match[2]) };
}

export function birthdayDateText(person) {
  const parts = birthdayParts(person);
  if (!parts) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' })
    .format(new Date(2000, parts.month, parts.day));
}

export function birthdayRelativeDays(person, from = new Date()) {
  const parts = birthdayParts(person);
  if (!parts) return Number.POSITIVE_INFINITY;
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  const occurrence = new Date(today.getFullYear(), parts.month, parts.day);
  occurrence.setHours(0, 0, 0, 0);
  return Math.round((occurrence - today) / 86400000);
}

export function birthdayStatus(person) {
  const days = birthdayRelativeDays(person);
  if (days === 0) return { text: 'Hoje', cls: 'today' };
  if (days === 1) return { text: 'Amanhã', cls: 'soon' };
  if (days > 1) return { text: `Daqui a ${days} dias`, cls: days <= 7 ? 'soon' : '' };
  if (days === -1) return { text: 'Ontem', cls: 'past' };
  return { text: `Há ${Math.abs(days)} dias`, cls: 'past' };
}

export function currentMonthBirthdays() {
  const today = new Date();
  const month = today.getMonth();
  return state.data.birthdays
    .filter(person => birthdayParts(person)?.month === month)
    .sort((a, b) => {
      const aDays = birthdayRelativeDays(a, today);
      const bDays = birthdayRelativeDays(b, today);
      const aUpcoming = aDays >= 0;
      const bUpcoming = bDays >= 0;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming) return aDays - bDays || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      return bDays - aDays || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
}

export function appointments() {
  const events = state.data.events.map(event => ({
    ...event, type: 'event', title: event.name, details: event.description
  }));
  const meetings = state.data.meetings.map(meeting => ({
    ...meeting, type: 'meeting', title: meeting.theme || 'Reunião', details: meeting.notes
  }));
  return [...events, ...meetings].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function upcomingAppointments(limit = Infinity) {
  const today = dateKey(todayStart());
  return appointments()
    .filter(item => item.date >= today && normalize(item.status) !== 'cancelado')
    .slice(0, limit);
}

export function noticeExpired(notice) {
  if (!notice.endDate) return false;
  const end = parseLocalDate(notice.endDate);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}

export function publicNotices() {
  return state.data.notices.filter(notice => !noticeExpired(notice)).sort((a, b) => b.date.localeCompare(a.date));
}

export function historicalNotices() {
  return state.data.notices.filter(noticeExpired).sort((a, b) => b.date.localeCompare(a.date));
}
