import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relative => readFile(path.join(projectRoot, relative), 'utf8');

test('cobrança familiar preserva o período filtrado, independente das pendências do membro clicado', async () => {
  const [memberships, viewMemberships, sharing] = await Promise.all([
    source('assets/js/modules/treasury/memberships.js'),
    source('assets/js/modules/treasury/view-memberships.js'),
    source('assets/js/modules/treasury-admin/sharing.js')
  ]);

  assert.match(memberships, /data-membership-period="\$\{escapeHtml\(membershipMonths\.join\(','\)\)\}"/);
  assert.match(viewMemberships, /button\.dataset\.membershipPeriod/);
  assert.match(viewMemberships, /shareMembershipCharge\(button\.dataset\.membershipCharge, months, periodMonths\)/);
  assert.match(sharing, /return async \(memberId, months = \[\], periodMonths = months\) =>/);
  assert.match(sharing, /const familyRequestedMonths = filteredPeriodMonths\.length \? filteredPeriodMonths : pendingMonths/);
  assert.match(sharing, /buildFamilyPayload\(group, familyRequestedMonths, clubName\)/);
  assert.match(sharing, /requestedMonths: familyRequestedMonths/);
});
