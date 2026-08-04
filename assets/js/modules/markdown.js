import { escapeHtml } from '../utils.js';

const MARKDOWN_HELP = [
  ['B', 'Negrito', '**', '**'],
  ['I', 'Itálico', '__', '__'],
  ['S', 'Tachado', '~~', '~~'],
  ['`', 'Código', '`', '`'],
  ['H2', 'Subtítulo', '## ', ''],
  ['•', 'Lista', '- ', ''],
  ['1.', 'Lista numerada', '1. ', ''],
  ['❝', 'Citação', '> ', ''],
  ['🔗', 'Link', '[texto](', ')'],
  ['ℹ️', 'Informação', ':::info\n', '\n:::'],
  ['⚠️', 'Atenção', ':::warning\n', '\n:::'],
  ['✅', 'Sucesso', ':::success\n', '\n:::']
];

function safeMarkdownUrl(value) {
  try {
    const url = new URL(
      String(value || '').trim(),
      location.href
    );

    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function inlineMarkdown(value) {
  let text = escapeHtml(String(value || ''));
  const stash = [];

  const hold = html => {
    stash.push(html);
    return `\u0000${stash.length - 1}\u0000`;
  };

  text = text.replace(
    /`([^`\n]+)`/g,
    (_, code) => hold(`<code>${code}</code>`)
  );

  text = text.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (_, label, url) => {
      const safe = safeMarkdownUrl(url);

      return safe
        ? hold(
            `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`
          )
        : label;
    }
  );

  text = text.replace(
    /(^|[\s(])(https?:\/\/[^\s<]+)/g,
    (match, prefix, url) => {
      const clean = url.replace(/[.,;!?]+$/, '');
      const suffix = url.slice(clean.length);
      const safe = safeMarkdownUrl(clean);

      return safe
        ? `${prefix}${hold(
            `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a>`
          )}${suffix}`
        : match;
    }
  );

  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g, '<em>$1</em>');
  text = text.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    '<em>$1</em>'
  );
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  text = text.replace(
    /\u0000(\d+)\u0000/g,
    (_, index) => stash[Number(index)] || ''
  );

  return text;
}

export function markdownToHtml(source) {
  const raw = String(source || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!raw) return '';

  const lines = raw.split('\n');

  let html = '';
  let list = null;
  let callout = null;
  let calloutLines = [];

  const closeList = () => {
    if (!list) return;

    html += `</${list}>`;
    list = null;
  };

  const closeCallout = () => {
    if (!callout) return;

    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      success: '✅',
      danger: '⛔'
    };

    html += `
      <aside class="md-callout md-${callout}">
        <span>${icons[callout] || 'ℹ️'}</span>
        <div>${markdownToHtml(calloutLines.join('\n'))}</div>
      </aside>
    `;

    callout = null;
    calloutLines = [];
  };

  for (const line of lines) {
    const call = line.match(
      /^:::(info|warning|success|danger)\s*$/i
    );

    if (call && !callout) {
      closeList();
      callout = call[1].toLowerCase();
      continue;
    }

    if (/^:::\s*$/.test(line) && callout) {
      closeCallout();
      continue;
    }

    if (callout) {
      calloutLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    let match;

    if ((match = line.match(/^(#{1,3})\s+(.+)$/))) {
      closeList();

      const level = Math.min(4, match[1].length + 1);

      html += `<h${level}>${inlineMarkdown(match[2])}</h${level}>`;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      html += '<hr>';
      continue;
    }

    if ((match = line.match(/^>\s?(.*)$/))) {
      closeList();
      html += `<blockquote>${inlineMarkdown(match[1])}</blockquote>`;
      continue;
    }

    if ((match = line.match(/^[-*+]\s+(.+)$/))) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        html += '<ul>';
      }

      html += `<li>${inlineMarkdown(match[1])}</li>`;
      continue;
    }

    if ((match = line.match(/^\d+[.)]\s+(.+)$/))) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html += '<ol>';
      }

      html += `<li>${inlineMarkdown(match[1])}</li>`;
      continue;
    }

    closeList();
    html += `<p>${inlineMarkdown(line)}</p>`;
  }

  closeList();
  closeCallout();

  return html;
}

export function markdownEditor(
  name,
  value,
  {
    required = false,
    placeholder = 'Digite o conteúdo…'
  } = {}
) {
  const toolbar = MARKDOWN_HELP.map(
    ([label, title, before, after]) => `
      <button
        class="md-tool"
        type="button"
        data-md-before="${escapeHtml(before)}"
        data-md-after="${escapeHtml(after)}"
        title="${title}"
        aria-label="${title}"
      >
        ${label}
      </button>
    `
  ).join('');

  return `
    <div class="markdown-editor" data-markdown-editor>
      <div class="markdown-toolbar">
        ${toolbar}

        <button
          class="md-tool md-help"
          type="button"
          data-md-help
          title="Ajuda de formatação"
        >
          ?
        </button>
      </div>

      <div class="markdown-editor-grid">
        <div class="markdown-write">
          <textarea
            name="${name}"
            rows="10"
            ${required ? 'required' : ''}
            placeholder="${escapeHtml(placeholder)}"
          >${escapeHtml(value || '')}</textarea>
        </div>

        <div class="markdown-preview">
          <div class="markdown-preview-label">
            Pré-visualização
          </div>

          <div
            class="markdown-body"
            data-md-preview
          ></div>
        </div>
      </div>

      <small class="markdown-hint">
        Use <strong>**negrito**</strong>,
        <em>__itálico__</em>, listas, títulos,
        links e blocos de destaque.
      </small>
    </div>
  `;
}

export function setupMarkdownEditors(
  scope = document,
  notify = () => {}
) {
  scope
    .querySelectorAll('[data-markdown-editor]')
    .forEach(editor => {
      const textarea = editor.querySelector('textarea');
      const preview = editor.querySelector('[data-md-preview]');

      if (!textarea || !preview) return;

      const update = () => {
        preview.innerHTML =
          markdownToHtml(textarea.value) ||
          '<p class="md-empty">A pré-visualização aparecerá aqui.</p>';
      };

      editor
        .querySelectorAll('[data-md-before]')
        .forEach(button => {
          button.onclick = () => {
            const before = button.dataset.mdBefore || '';
            const after = button.dataset.mdAfter || '';
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selected = textarea.value.slice(start, end);
            const replacement =
              before + (selected || 'texto') + after;

            textarea.setRangeText(
              replacement,
              start,
              end,
              'select'
            );

            textarea.focus();
            update();
          };
        });

      editor
        .querySelector('[data-md-help]')
        ?.addEventListener('click', () => {
          notify(
            'Formatação: **negrito**, __itálico__, ~~tachado~~, # título, - lista, > citação, [texto](link) e :::warning.'
          );
        });

      textarea.addEventListener('input', update);
      update();
    });
}