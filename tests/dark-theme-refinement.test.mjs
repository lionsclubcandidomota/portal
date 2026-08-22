import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('superfícies críticas respeitam os tokens do tema em vez de branco fixo', async () => {
  const [core, memberships, agenda, markdown, adminOperations, settings, responsive] = await Promise.all([
    source('assets/css/components/core.css'),
    source('assets/css/pages/memberships.css'),
    source('assets/css/pages/agenda.css'),
    source('assets/css/components/markdown.css'),
    source('assets/css/pages/admin-operations.css'),
    source('assets/css/pages/settings.css'),
    source('assets/css/pages/responsive-workflows.css')
  ]);

  assert.match(core, /\.card,[^{]*\.dated-generic-card\{[^}]*background:var\(--surface\)/);
  assert.match(memberships, /\.membership-member\{[^}]*background:var\(--surface\) !important/);
  assert.doesNotMatch(memberships, /\.membership-member\{[^}]*background:#fff !important/);
  assert.match(agenda, /\.agenda-overview-card\{[^}]*var\(--surface\)[^}]*var\(--surface-2\)/);
  assert.match(agenda, /\.agenda-command-card\{[^}]*background:var\(--surface-glass\)/);
  assert.match(markdown, /\.markdown-editor\{[^}]*background:var\(--surface\)/);
  assert.match(markdown, /\.markdown-preview\{[^}]*background:var\(--surface-2\)/);
  assert.match(adminOperations, /\.admin-form-actions\{[\s\S]*?background:var\(--surface-glass\)/);
  assert.match(settings, /\.settings-savebar\{[^}]*background:var\(--surface-glass\)/);
  assert.match(responsive, /\.treasury-record-card\{[^}]*background:var\(--surface\)!important/);
});

test('paleta de Mútuas possui tokens próprios para claro e escuro', async () => {
  const [tokens, memberships, mutualRegistration] = await Promise.all([
    source('assets/css/tokens.css'),
    source('assets/css/pages/memberships.css'),
    source('assets/css/pages/mutual-registration.css')
  ]);

  assert.match(tokens, /--mutual:\s*#6548a1/);
  assert.match(tokens, /html\[data-theme="dark"\][\s\S]*--mutual:\s*#cbbcf2/);
  assert.match(tokens, /html\[data-theme="dark"\][\s\S]*--mutual-soft:\s*#2b2540/);
  assert.match(memberships, /color:var\(--mutual\)/);
  assert.match(mutualRegistration, /color:var\(--mutual-strong\)/);
});

test('notificações e campos de data usam superfícies semânticas compatíveis com o tema escuro', async () => {
  const [interaction, core, tokens, dark] = await Promise.all([
    source('assets/css/components/interaction-foundation.css'),
    source('assets/css/components/core.css'),
    source('assets/css/tokens.css'),
    source('assets/css/components/dark-theme.css')
  ]);

  assert.match(interaction, /\.portal-toast\{[^}]*background:color-mix\(in srgb,var\(--toast-tone\) 5%,var\(--surface\)\)/);
  assert.doesNotMatch(interaction, /\.portal-toast\{[^}]*rgba\(255,255,255/);
  assert.match(core, /input\[type="date"\]:required:invalid\{[^}]*var\(--surface\)/);
  assert.doesNotMatch(core, /input\[type="date"\]:required:invalid\{[^}]*#fff/);
  assert.match(tokens, /html\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/);
  assert.match(dark, /html\[data-theme="dark"\] input,[^\n]*background:var\(--surface\)/);
});


test('pagamentos vinculados do Extrato usam superfície temática no modo escuro', async () => {
  const statement = await source('assets/css/pages/membership-statement.css');

  assert.match(statement, /\.membership-statement-row-details\{[^}]*background:var\(--surface-2\)/);
  assert.match(statement, /\.membership-statement-row-details\{[^}]*border-top:1px solid var\(--border\)/);
  assert.doesNotMatch(statement, /\.membership-statement-row-details\{[^}]*rgba\(248,251,253/);
  assert.match(statement, /\.membership-statement-payments>span\{[^}]*border:1px solid var\(--border\)/);
});

test('Agenda da home visitante e Central de sincronização não dependem de superfícies brancas no dark mode', async () => {
  const [tokens, modern, responsive, shell, publication] = await Promise.all([
    source('assets/css/tokens.css'),
    source('assets/css/components/modern-interface.css'),
    source('assets/css/components/responsive-guardrails.css'),
    source('assets/css/foundations/application-shell.css'),
    source('assets/css/components/publication-center.css')
  ]);

  assert.match(tokens, /--surface-raised:/);
  assert.match(tokens, /--panel-border:/);
  assert.match(modern, /\.dashboard-appointments-grid > \.appointment-home-item\s*\{[^}]*background:linear-gradient\([^}]*var\(--surface-raised\)/s);
  assert.match(responsive, /\.grid-main>\.card\.col-12:has\(\[data-go="agenda"\]\)\{[^}]*var\(--surface-raised\)/);
  assert.doesNotMatch(responsive, /\.grid-main>\.card\.col-12:has\(\[data-go="agenda"\]\)\{[^}]*#fff/);
  assert.match(shell, /\.appointment-type-icon\{[^}]*var\(--surface\)/);
  assert.match(publication, /\.publication-workspace-heading\{[^}]*var\(--surface-raised\)/);
  assert.match(publication, /\.publication-status-card\{[^}]*var\(--surface-raised\)/);
  assert.doesNotMatch(publication, /\.publication-workspace-heading\{[^}]*#fff/);
  assert.doesNotMatch(publication, /\.publication-status-card\{[^}]*#fff/);
});
