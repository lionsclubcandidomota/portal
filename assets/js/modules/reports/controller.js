import { buildReport } from './domain.js?v=6.52.0';
import { REPORT_TYPES } from './catalog.js?v=6.52.0';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function plainText(value = '') {
  return String(value)
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
    .replace(/[*_~`>#]/g, '')
    .replace(/\r?\n+/g, ' · ')
    .trim();
}

function toneClass(value = '') {
  const tone = String(value || '').trim().toLowerCase();
  return ['positive', 'negative', 'warning', 'primary'].includes(tone) ? ` is-${tone}` : '';
}

function cellBadge(value = '') {
  const key = plainText(value).toLocaleLowerCase('pt-BR');
  if (['em dia', 'quitada', 'paga', 'recebido', 'realizado', 'concluído', 'concluido'].includes(key)) return ' is-positive';
  if (['parcial', 'em andamento', 'confirmado'].includes(key)) return ' is-primary';
  if (['pendente', 'em aberto', 'programado', 'agendado', 'média', 'media'].includes(key)) return ' is-warning';
  if (['cancelado', 'cancelada', 'alta', 'vencida', 'vencido'].includes(key)) return ' is-negative';
  return '';
}

function renderTableCell(cell, column = '') {
  const text = plainText(cell);
  const badge = /situa|status|prioridade/i.test(column) ? cellBadge(text) : '';
  return `<td data-label="${escapeHtml(column)}">${badge ? `<span class="data-badge${badge}">${escapeHtml(text)}</span>` : escapeHtml(text)}</td>`;
}

export function reportHtml(report) {
  const tableRows = report.rows.length
    ? report.rows.map(row => `<tr>${row.map((cell, index) => renderTableCell(cell, report.columns[index] || '')).join('')}</tr>`).join('')
    : `<tr><td colspan="${report.columns.length}" class="empty">Nenhum registro encontrado para o período.</td></tr>`;
  const summaryItems = (report.summary || []).map(item => `<article class="metric${toneClass(item.tone)}"><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></article>`).join('');
  const insightItems = (report.insights || []).map(item => `<article class="insight${toneClass(item.tone)}"><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong>${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}</article>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.title)} — ${escapeHtml(report.clubName)}</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#eef3f8;--blue:#00529b;--blue-soft:#eaf4fc;--line:#dce5ee;--muted:#64748b;--surface:#fff;--surface-2:#f7f9fc;--green:#0f8a5f;--green-soft:#edf9f4;--red:#c23b3b;--red-soft:#fff1f1;--amber:#a76900;--amber-soft:#fff8e7}*{box-sizing:border-box}body{margin:0;padding:28px;background:linear-gradient(180deg,#eef5fb 0,#f7f9fc 240px);color:#172033}.report{max-width:1240px;margin:auto;background:var(--surface);border:1px solid #d7e1ea;border-radius:22px;box-shadow:0 18px 55px rgba(18,45,75,.1);overflow:hidden}.header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;padding:30px 34px 26px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#fff 0,#f8fbfe 62%,#edf6fc 100%)}.eyebrow{display:inline-flex;align-items:center;gap:7px;margin-bottom:7px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:850;color:var(--blue)}.header h1{margin:0 0 8px;font-size:clamp(25px,3vw,34px);line-height:1.1;letter-spacing:-.025em}.header p{max-width:760px;margin:0;color:#58677a;font-size:14px;line-height:1.6}.meta{min-width:230px;padding:14px 16px;border:1px solid #cfe0ee;border-radius:15px;background:rgba(255,255,255,.78);color:#5c687c;font-size:11px;line-height:1.45}.meta small,.meta strong{display:block}.meta small{margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#7a8798}.meta strong{color:#1e3b57;font-size:13px}.meta-separator{height:1px;margin:10px 0;background:#e2e9f0}.print-btn{width:100%;border:0;border-radius:10px;background:var(--blue);color:#fff;font-weight:800;padding:10px 14px;cursor:pointer;margin-top:12px}.summary-shell{padding:22px 34px;background:#f8fafc;border-bottom:1px solid var(--line)}.section-label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}.section-label strong{font-size:13px}.section-label span{color:var(--muted);font-size:11px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.metric{position:relative;min-width:0;padding:13px 14px 12px;border:1px solid #dfe7ee;border-radius:13px;background:#fff;overflow:hidden}.metric:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:#bcc9d6}.metric small,.metric strong{display:block}.metric small{margin-bottom:4px;color:#6b778a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.metric strong{font-size:17px;line-height:1.2;overflow-wrap:anywhere}.metric.is-primary:before{background:#2183c4}.metric.is-positive:before{background:var(--green)}.metric.is-negative:before{background:var(--red)}.metric.is-warning:before{background:#d29318}.metric.is-positive strong{color:var(--green)}.metric.is-negative strong{color:var(--red)}.metric.is-warning strong{color:var(--amber)}.insights-shell{padding:22px 34px 4px}.insights{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:11px}.insight{padding:14px 15px;border:1px solid #dfe7ee;border-radius:14px;background:#fff}.insight small,.insight strong,.insight p{display:block;margin:0}.insight small{color:#6f7d90;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}.insight strong{margin-top:5px;font-size:16px;line-height:1.25}.insight p{margin-top:4px;color:#68778a;font-size:11px;line-height:1.4}.insight.is-primary{background:#f4f9fd;border-color:#cfe1ef}.insight.is-positive{background:var(--green-soft);border-color:#cde9dc}.insight.is-negative{background:var(--red-soft);border-color:#efd0d0}.insight.is-warning{background:var(--amber-soft);border-color:#ecdcae}.table-shell{padding:24px 34px 32px;overflow:auto}.table-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px}.table-heading h2{margin:0;font-size:16px}.table-heading span{color:var(--muted);font-size:11px;font-weight:750}.table-frame{overflow:auto;border:1px solid #dce5ee;border-radius:15px}table{width:100%;border-collapse:separate;border-spacing:0;font-size:11px;background:#fff}thead{display:table-header-group}th{position:sticky;top:0;z-index:1;background:#eef5fb;color:#274966;text-align:left;padding:10px;border-bottom:1px solid #d7e3ec;white-space:nowrap;font-size:10px;text-transform:uppercase;letter-spacing:.035em}td{padding:10px;border-bottom:1px solid #e7ecf1;vertical-align:top;min-width:90px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.4}tbody tr:nth-child(even){background:#fbfcfd}tbody tr:last-child td{border-bottom:0}.data-badge{display:inline-flex;align-items:center;padding:4px 7px;border:1px solid #dce4eb;border-radius:999px;background:#f5f7f9;color:#4f5d6f;font-size:9px;font-weight:850;white-space:nowrap}.data-badge.is-positive{border-color:#bfe3d3;background:var(--green-soft);color:#0d7551}.data-badge.is-primary{border-color:#c7dff0;background:var(--blue-soft);color:#1769a1}.data-badge.is-warning{border-color:#e8d49c;background:var(--amber-soft);color:#8d5b00}.data-badge.is-negative{border-color:#edc7c7;background:var(--red-soft);color:#ad3131}.empty{text-align:center;color:#69758a;padding:34px}.report-note{margin:0 34px 24px;padding:11px 13px;border-left:3px solid #70a9d1;border-radius:0 10px 10px 0;background:#f4f8fb;color:#607084;font-size:11px;line-height:1.5}.footer{display:flex;justify-content:space-between;gap:14px;padding:16px 34px 22px;border-top:1px solid #edf1f5;color:#7b8797;font-size:10px}
    @media(max-width:720px){body{padding:10px}.report{border-radius:16px}.header{grid-template-columns:1fr;padding:22px 18px}.meta{min-width:0}.summary-shell,.insights-shell,.table-shell{padding-left:18px;padding-right:18px}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.insights{grid-template-columns:1fr}.table-frame{border:0;overflow:visible}table,tbody,tr,td{display:block;width:100%}thead{display:none}tbody{display:grid;gap:10px}tbody tr{padding:8px 12px;border:1px solid var(--line);border-radius:13px;background:#fff!important}td{display:grid;grid-template-columns:minmax(90px,35%) minmax(0,1fr);gap:10px;min-width:0;padding:7px 0;border:0;border-bottom:1px solid #eef2f5}td:last-child{border-bottom:0}td:before{content:attr(data-label);color:#718096;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.035em}.report-note{margin-left:18px;margin-right:18px}.footer{padding-left:18px;padding-right:18px;flex-direction:column}}
    @media print{body{padding:0;background:#fff}.report{max-width:none;border:0;border-radius:0;box-shadow:none}.header{padding:12px 14px 10px;background:#fff}.header h1{font-size:22px}.header p{font-size:10px}.meta{border:0;padding:0;min-width:180px}.print-btn{display:none}.summary-shell{padding:9px 14px;background:#fff}.summary{gap:5px}.metric{padding:7px 8px}.metric small{font-size:7px}.metric strong{font-size:11px}.insights-shell{padding:9px 14px 0}.insights{grid-template-columns:repeat(4,1fr);gap:5px}.insight{padding:7px 8px}.insight small{font-size:7px}.insight strong{font-size:10px}.insight p{font-size:7px}.table-shell{padding:10px 14px 16px;overflow:visible}.table-heading{margin-bottom:6px}.table-heading h2{font-size:11px}.table-frame{overflow:visible;border-radius:6px}table{font-size:7px}th{position:static;padding:5px 4px;font-size:6px}td{padding:5px 4px;min-width:0;line-height:1.25}.data-badge{padding:2px 4px;font-size:6px}.report-note{margin:0 14px 9px;padding:6px 8px;font-size:7px}.footer{padding:7px 14px 0;font-size:7px}@page{size:landscape;margin:8mm}}
  </style>
</head>
<body>
  <main class="report">
    <header class="header"><div><span class="eyebrow">${escapeHtml(report.clubName)} · Relatório gerencial</span><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.description)}</p></div><aside class="meta"><small>Período analisado</small><strong>${escapeHtml(report.periodText)}</strong><div class="meta-separator"></div><small>Gerado em</small><strong>${escapeHtml(report.generatedAt)}</strong><button class="print-btn" type="button" id="printReportButton">Imprimir / salvar em PDF</button></aside></header>
    <section class="summary-shell"><div class="section-label"><strong>Resumo executivo</strong><span>Indicadores principais</span></div><div class="summary">${summaryItems}</div></section>
    ${insightItems ? `<section class="insights-shell"><div class="section-label"><strong>Leitura rápida</strong><span>Pontos para conferência</span></div><div class="insights">${insightItems}</div></section>` : ''}
    <section class="table-shell"><div class="table-heading"><h2>${escapeHtml(report.tableTitle || 'Detalhamento')}</h2><span>${escapeHtml(report.rowCountLabel || `${report.rows.length} registro(s)`)}</span></div><div class="table-frame"><table><thead><tr>${report.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></div></section>
    ${report.note ? `<p class="report-note">${escapeHtml(report.note)}</p>` : ''}
    <footer class="footer"><span>Portal Lions · Relatório gerado pelo Portal Administrativo</span><span>${escapeHtml(report.periodText)}</span></footer>
  </main>
</body>
</html>`;
}

function csvCell(value) {
  const text = plainText(value).replaceAll('"', '""');
  return `"${text}"`;
}

export function reportCsv(report) {
  const summary = (report.summary || []).map(item => [item.label, item.value]);
  const insights = (report.insights || []).flatMap((item, index) => [
    index === 0 ? ['Leitura rápida'] : [],
    [item.label, item.value, item.detail || '']
  ]).filter(row => row.length);
  const rows = [
    [report.clubName],
    [report.title],
    ['Período', report.periodText],
    ['Gerado em', report.generatedAt],
    [],
    ['Resumo executivo'],
    ...summary,
    ...(insights.length ? [[], ...insights] : []),
    ...(report.note ? [[], ['Observação', report.note]] : []),
    [],
    report.columns,
    ...report.rows
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}`;
}

function fileSlug(value) {
  return String(value || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createReportsController({
  getState,
  toast,
  browserWindow = window,
  browserDocument = document
}) {
  if (typeof getState !== 'function') throw new TypeError('createReportsController requer getState().');

  const create = (type, options) => buildReport(type, getState(), options);

  const openPrintView = (type, options) => {
    const report = create(type, options);
    const reportWindow = browserWindow.open('', '_blank');
    if (!reportWindow) {
      toast?.('O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente.');
      return false;
    }
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(reportHtml(report));
    reportWindow.document.close();
    reportWindow.document.getElementById('printReportButton')?.addEventListener('click', () => reportWindow.print());
    return true;
  };

  const downloadCsv = (type, options) => {
    const report = create(type, options);
    const blob = new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = browserDocument.createElement('a');
    anchor.href = url;
    anchor.download = `${fileSlug(report.title)}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.hidden = true;
    browserDocument.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast?.('Relatório CSV gerado.');
    return true;
  };

  const bindDashboard = (root, options) => {
    const reportType = root?.querySelector?.('#adminReportType');
    const reportButtons = [...(root?.querySelectorAll?.('[data-report-type]') || [])];
    const title = root?.querySelector?.('#adminReportSelectionTitle');
    const description = root?.querySelector?.('#adminReportSelectionDescription');
    const hint = root?.querySelector?.('#adminReportSelectionHint');
    const group = root?.querySelector?.('#adminReportSelectionGroup');

    const selectType = type => {
      const metadata = REPORT_TYPES[type] || REPORT_TYPES.movements;
      if (reportType) reportType.value = type;
      reportButtons.forEach(button => {
        const selected = button.dataset.reportType === type;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (title) title.textContent = metadata.label;
      if (description) description.textContent = metadata.description;
      if (hint) hint.textContent = metadata.hint;
      if (group) group.textContent = metadata.group;
    };

    reportButtons.forEach(button => button.addEventListener('click', () => selectType(button.dataset.reportType || 'movements')));
    selectType(reportType?.value || 'movements');

    const run = action => {
      try {
        action(reportType?.value || 'movements', options);
      } catch (error) {
        toast?.(error.message || 'Não foi possível gerar o relatório.');
      }
    };
    root?.querySelector?.('#generateReportPrint')?.addEventListener('click', () => run(openPrintView));
    root?.querySelector?.('#generateReportCsv')?.addEventListener('click', () => run(downloadCsv));
  };

  return { openPrintView, downloadCsv, bindDashboard };
}
