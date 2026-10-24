import test from 'node:test';
import assert from 'node:assert/strict';
import { propertiesColorDraft, editPropertiesColor, parsePropertiesColor } from '../test-build/editors/properties/color-draft.js';
import { PropertiesFieldController } from '../test-build/editors/properties/controller.js';

const pair = { color: '#123456', opacity: .4, noFill: true };
const edit = (raw, part, value) => editPropertiesColor(propertiesColorDraft(raw), part, value);

test('#1051 inline HEX accepts optional hash and shorthand; opacity is atomic and preserves No fill', () => {
  for (const hex of ['abc', '#ABC', 'aabbcc', '#aAbBcC']) {
    const raw = edit(JSON.stringify(pair), 'hex', hex);
    const parsed = parsePropertiesColor(edit(raw, 'opacity', '100'));
    assert.deepEqual(parsed, { ok: true, value: { color: '#aabbcc', opacity: 1, noFill: true } });
    assert.equal('inline' in parsed.value, false);
  }
  assert.equal(parsePropertiesColor(edit(JSON.stringify(pair), 'opacity', '0')).value.opacity, 0);
  assert.deepEqual(parsePropertiesColor(JSON.stringify({...pair,opacity:.333333})).value,{...pair,opacity:.333333});
});

test('#1051 incomplete/invalid input retains the last valid preview, never yields a partial commit', () => {
  const valid = edit(edit(JSON.stringify(pair), 'hex', 'f00'), 'opacity', '75');
  for (const [part, value] of [['hex', '#12'], ['hex', 'red'], ['hex', '#fffffff'], ['opacity', ''], ['opacity', '-1'], ['opacity', '101']]) {
    const raw = edit(valid, part, value), state = propertiesColorDraft(raw);
    assert.equal(parsePropertiesColor(raw).ok, false, value);
    assert.deepEqual(state.value, { color: '#ff0000', opacity: .75, noFill: true });
  }
  for (const value of ['null', '{}', 'true', '{"color":"bad","opacity":4}', JSON.stringify({ ...pair, inline: { hex: 1, opacity: '' } })]) {
    assert.equal(propertiesColorDraft(value), null);
    assert.equal(parsePropertiesColor(value).ok, false);
  }
});

test('#1051 preview ownership, external replacement, cancellation and Enter/blur one-write receipt', async () => {
  let identity = { spaceId: 's', editor: 'decor', kind: 'rect', objectId: 'a' }, authority = {}, value = pair;
  const commits = [];
  const c = new PropertiesFieldController({ identity: () => identity, authority: () => authority,
    read: () => value, parse: (_, raw) => parsePropertiesColor(raw), changed() {}, focus() {},
    commit: async (_, __, next, before, current) => {
      assert.equal(current(), true); commits.push({ next, before }); value = next; return { ok: true };
    } });
  const raw = edit(JSON.stringify(pair), 'hex', 'f00');
  c.edit('fill', raw); assert.ok(c.previewDraft);
  const enter = c.finish(), blur = c.finish();
  assert.equal(enter, blur); assert.equal(await enter, true); assert.equal(commits.length, 1);
  c.edit('fill', raw); c.cancel(); assert.equal(c.previewDraft, null); assert.equal(commits.length, 1);
  c.edit('fill', raw); value = { ...value, opacity: .9 }; assert.equal(c.previewDraft, null);
  assert.equal(await c.finish(), false); c.cancel();
  c.edit('fill', raw); authority = {}; assert.equal(c.previewDraft, null); c.sync(); assert.equal(c.draft, null);
  c.edit('fill', raw); identity = { ...identity, spaceId: 'other' }; assert.equal(c.previewDraft, null);
});
