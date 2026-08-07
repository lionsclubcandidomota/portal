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
    <footer class="footer">Relatório gerado pelo Portal Administrativo.${report.dataSource === 'd1' ? ` Dados financeiros consultados diretamente no D1 em ${Math.max(0, Number(report.queryDurationMs || 0))} ms.` : ''}</footer>
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
  browserDocument = document,
  loadReportState = null
}) {
  if (typeof getState !== 'function') throw new TypeError('createReportsController requer getState().');

  const privateReportTypes = new Set(['movements', 'memberships', 'mutuals']);

  const create = async (type, options) => {
    const localState = getState();
    let reportState = localState;
    let dataSource = 'local';
    let queryDurationMs = 0;
    if (privateReportTypes.has(type) && typeof loadReportState === 'function') {
      try {
        const payload = await loadReportState(localState, type, options?.bounds || {});
        if (payload?.state && typeof payload.state === 'object') {
          reportState = { ...localState, ...payload.state };
          dataSource = payload.source === 'd1' ? 'd1' : 'local';
          queryDurationMs = Math.max(0, Number(payload.queryDurationMs || 0));
        }
      } catch {
        // Mantém a geração local como contingência se a leitura SQL estiver indisponível.
      }
    }
    return {
      ...buildReport(type, reportState, options),
      dataSource,
      queryDurationMs
    };
  };

  const loadingHtml = () => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando relatório</title><style>body{font-family:Inter,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f7fa;color:#172033}.loading{padding:28px 34px;border:1px solid #dfe5ec;border-radius:18px;background:#fff;box-shadow:0 12px 36px rgba(23,32,51,.08);text-align:center}.loading span{display:block;font-size:32px;margin-bottom:10px}.loading small{color:#69758a}</style></head><body><div class="loading"><span>📊</span><strong>Consultando o banco de dados…</strong><small>O relatório será aberto em instantes.</small></div></body></html>`;

  const openPrintView = async (type, options) => {
    const reportWindow = browserWindow.open('', '_blank');
    if (!reportWindow) {
      toast?.('O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente.');
      return false;
    }
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(loadingHtml());
    reportWindow.document.close();
    try {
      const report = await create(type, options);
      reportWindow.document.open();
      reportWindow.document.write(reportHtml(report));
      reportWindow.document.close();
      reportWindow.document.getElementById('printReportButton')?.addEventListener('click', () => reportWindow.print());
      return true;
    } catch (error) {
      reportWindow.close();
      throw error;
    }
  };

  const downloadCsv = async (type, options) => {
    const report = await create(type, options);
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
    toast?.(report.dataSource === 'd1' ? 'Relatório CSV gerado a partir do D1.' : 'Relatório CSV gerado.');
    return true;
  };

  const bindDashboard = (root, options) => {
    const reportType = root?.querySelector?.('#adminReportType');
    const buttons = [
      root?.querySelector?.('#generateReportPrint'),
      root?.querySelector?.('#generateReportCsv')
    ].filter(Boolean);
    const run = async action => {
      buttons.forEach(button => { button.disabled = true; });
      try {
        await action(reportType?.value || 'movements', options);
      } catch (error) {
        toast?.(error.message || 'Não foi possível gerar o relatório.');
      } finally {
        buttons.forEach(button => { button.disabled = false; });
      }
    };
    root?.querySelector?.('#generateReportPrint')?.addEventListener('click', () => run(openPrintView));
    root?.querySelector?.('#generateReportCsv')?.addEventListener('click', () => run(downloadCsv));
  };

  return { openPrintView, downloadCsv, bindDashboard };
}
