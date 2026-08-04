import { buildReport } from './domain.js';

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

function reportHtml(report) {
  const tableRows = report.rows.length
    ? report.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(plainText(cell))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${report.columns.length}" class="empty">Nenhum registro encontrado para o período.</td></tr>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.title)} — ${escapeHtml(report.clubName)}</title>
  <style>
    :root{font-family:Inter,Arial,sans-serif;color:#172033;background:#f5f7fa}*{box-sizing:border-box}body{margin:0;padding:24px;background:#f5f7fa}.report{max-width:1200px;margin:auto;background:#fff;border:1px solid #dfe5ec;border-radius:18px;box-shadow:0 12px 36px rgba(23,32,51,.08);overflow:hidden}.header{padding:28px 32px;border-bottom:1px solid #e6ebf1;display:flex;gap:20px;justify-content:space-between;align-items:flex-start}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#00529b}.header h1{margin:5px 0 6px;font-size:28px}.header p{margin:0;color:#5c687c;max-width:720px}.meta{text-align:right;font-size:12px;color:#5c687c;white-space:nowrap}.print-btn{border:0;border-radius:10px;background:#00529b;color:#fff;font-weight:700;padding:10px 14px;cursor:pointer;margin-top:12px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:20px 32px;background:#f8fafc}.summary div{padding:14px;border:1px solid #e1e7ee;border-radius:12px;background:#fff}.summary small{display:block;color:#69758a;margin-bottom:4px}.summary strong{font-size:18px}.table-shell{padding:24px 32px 32px;overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#eef5fb;color:#17395a;text-align:left;padding:11px 10px;border:1px solid #dce5ee;white-space:nowrap}td{padding:10px;border:1px solid #e2e7ed;vertical-align:top;min-width:90px;white-space:pre-wrap;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#fafbfd}.empty{text-align:center;color:#69758a;padding:32px}.footer{padding:0 32px 24px;color:#758196;font-size:11px}@media print{body{padding:0;background:#fff}.report{max-width:none;border:0;border-radius:0;box-shadow:none}.print-btn{display:none}.header,.summary,.table-shell{padding-left:12px;padding-right:12px}.table-shell{overflow:visible}table{font-size:9px}th,td{padding:6px 5px}@page{size:landscape;margin:10mm}}
  </style>
</head>
<body>
  <main class="report">
    <header class="header"><div><span class="eyebrow">${escapeHtml(report.clubName)}</span><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.description)}</p></div><div class="meta"><strong>Período</strong><br>${escapeHtml(report.periodText)}<br><br>Gerado em ${escapeHtml(report.generatedAt)}<br><button class="print-btn" type="button" id="printReportButton">Imprimir / salvar em PDF</button></div></header>
    <section class="summary">${report.summary.map(item => `<div><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</section>
    <section class="table-shell"><table><thead><tr>${report.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></section>
    <footer class="footer">Relatório gerado pelo Portal Administrativo.</footer>
  </main>
</body>
</html>`;
}

function csvCell(value) {
  const text = plainText(value).replaceAll('"', '""');
  return `"${text}"`;
}

export function reportCsv(report) {
  const summary = report.summary.map(item => [item.label, item.value]);
  const rows = [
    [report.clubName],
    [report.title],
    ['Período', report.periodText],
    ['Gerado em', report.generatedAt],
    [],
    ...summary,
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
