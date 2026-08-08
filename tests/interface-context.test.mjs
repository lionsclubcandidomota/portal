import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterfaceContextController } from '../assets/js/modules/interface-context.js';

function fixture() {
  const input = {
    id: 'treasurySearch',
    disabled: false,
    hidden: false,
    selectionStart: 2,
    selectionEnd: 5,
    ownerDocument: null,
    getAttribute: () => null,
    focusOptions: null,
    focus(options) { this.focusOptions = options; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  };
  const documentRef = {
    activeElement: input,
    body: {},
    documentElement: {
      scrollWidth: 1500,
      scrollHeight: 2800,
      style: { scrollBehavior: 'smooth' }
    },
    querySelector(selector) { return selector === '#treasurySearch' ? input : null; }
  };
  input.ownerDocument = documentRef;
  const calls = [];
  const windowRef = {
    scrollX: 35,
    scrollY: 740,
    innerWidth: 1000,
    innerHeight: 800,
    CSS: { escape: value => value },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { callback(); },
    scrollTo(options) { calls.push(options); }
  };
  return { input, documentRef, windowRef, calls };
}

test('captura tela, seção, rolagem e foco antes de reconstruir a interface', () => {
  const { documentRef, windowRef } = fixture();
  const controller = createInterfaceContextController({
    getCurrentView: () => 'treasury',
    getTreasurySection: () => 'memberships',
    documentRef,
    windowRef
  });

  const snapshot = controller.capture();

  assert.equal(snapshot.view, 'treasury');
  assert.equal(snapshot.treasurySection, 'memberships');
  assert.equal(snapshot.scrollY, 740);
  assert.equal(snapshot.focusSelector, '#treasurySearch');
  assert.deepEqual(snapshot.selection, { start: 2, end: 5 });
});

test('restaura a posição exata e o campo ativo após a renderização', () => {
  const { input, documentRef, windowRef, calls } = fixture();
  const controller = createInterfaceContextController({ documentRef, windowRef });
  const snapshot = controller.capture();
  let rendered = false;

  controller.renderPreserving(() => { rendered = true; }, { restoreFocus: true });

  assert.equal(rendered, true);
  assert.deepEqual(calls.at(-1), { left: 35, top: 740, behavior: 'auto' });
  assert.deepEqual(input.focusOptions, { preventScroll: true });
  assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 5]);
  assert.equal(documentRef.documentElement.style.scrollBehavior, 'smooth');
});
