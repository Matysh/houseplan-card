import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLayoutReads } from '../scripts/render-layout-read.mjs';

const cardText = 'class Card { render(){} _renderBody(){} willUpdate(){} _isoScene(){} }';
const summaryText = `class Summary {
  measureLayout(){ return this.stage.clientWidth; }
  measurePanelBox(){ return this.panel.offsetWidth; }
  updated(){ this.measurePanelBox(); }
  screenGeometry(){ this.measurePanelBox(); }
  render(){ return this.layout(); }
  layout(){ return {}; }
  willUpdate(){ this.afterFonts(); }
  afterFonts(){ Promise.resolve().then(() => this.measureLayout()); }
}`;
const inspect = (text = summaryText, extra = {}) => inspectLayoutReads({ cardText, summaryText: text, ...extra });

test('#1380 named post-render owners and deferred font measurement remain permitted', () => {
  assert.deepEqual(inspect(), []);
});
for (const read of ['this.panel.offsetLeft', 'this.panel["offsetHeight"]', 'getComputedStyle(this.panel)']) {
  test(`#1380 direct render layout read remains forbidden: ${read}`, () => {
    assert.ok(inspect(summaryText.replace('return {};', `return ${read};`)).some(p => p.includes('forces layout')));
  });
}
for (const body of ['this.measurePanelBox();', 'this.bridge();', '[1].map(() => this.measurePanelBox());', 'return this.box;']) {
  test(`#1380 a measurement helper cannot launder a render read: ${body}`, () => {
    const text = summaryText.replace('return {};', body).replace('updated(){',
      'bridge(){ this["measurePanelBox"](); } get box(){ return this.bridge(); } updated(){');
    assert.ok(inspect(text).some(p => p.includes('render path reaches measurement')));
  });
}
test('#1380 local call cycles terminate and missing measurement owners remain errors', () => {
  assert.deepEqual(inspect(summaryText.replace('return {};', 'return this.loop();')
    .replace('updated(){', 'loop(){ return this.layout(); } updated(){')), []);
  assert.ok(inspect(summaryText.replace('measurePanelBox(){ return this.panel.offsetWidth; }', ''))
    .some(p => p.includes('expected one measurement method measurePanelBox')));
});
test('#1380 card and iso guards are retained', () => {
  assert.ok(inspect(summaryText, { cardText: cardText.replace('render(){}', 'render(){ this.getBoundingClientRect(); }') })
    .some(p => p.startsWith('render forces layout')));
  assert.ok(inspect(summaryText, { isoTexts: [['iso-test.ts', 'const x = node.scrollHeight;']] })
    .some(p => p.startsWith('iso-test.ts forces layout')));
});
