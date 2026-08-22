import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('editar contas permite definir uma única conta ativa como padrão de mensalidades', async () => {
  const source = await readFile(path.join(projectRoot, 'assets/js/modules/treasury-admin/accounts.js'), 'utf8');

  assert.match(source, /Conta padrão para receber mensalidades/);
  assert.match(source, /membershipDefault/);
  assert.match(source, /accounts\.forEach\(account => \{ account\.membershipDefault = false; \}\)/);
  assert.match(source, /A conta padrão para mensalidades precisa estar ativa/);
  assert.match(source, /Padrão mensalidades/);
});

test('baixa de mensalidade pré-seleciona a conta padrão sem impedir escolha manual', async () => {
  const source = await readFile(path.join(projectRoot, 'assets/js/modules/treasury-admin/membership-payments.js'), 'utf8');

  assert.match(source, /membershipDefaultAccount/);
  assert.match(source, /defaultMembershipAccount\?\.id === account\.id \? 'selected' : ''/);
  assert.match(source, /name="accountId" required/);
  assert.match(source, /Pré-selecionada conforme a conta padrão de mensalidades/);
});


test('alteração da conta padrão entra na revisão de publicação', async () => {
  const source = await readFile(path.join(projectRoot, 'assets/js/modules/publication-review-domain.js'), 'utf8');

  assert.match(source, /membershipDefault: 'Padrão para mensalidades'/);
  assert.match(source, /fields: \['name', 'type', 'initialBalance', 'active', 'membershipDefault'\]/);
});
