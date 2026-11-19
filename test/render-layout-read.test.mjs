import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

const labelText = `class RoomFurnitureOverlap {
  render(){} update(){ this.schedule(); }
  schedule = () => { requestAnimationFrame(() => {
    const width = this.plane.clientWidth;
    this.boundPaint();
  }); };
  boundPaint(){ return getComputedStyle(this.plane).width + this.plane.offsetHeight; }
}`;
const inspectLabel = text => inspect(summaryText, { isoTexts: [['iso-room-furniture-overlap.ts', text]] });

test('#1473 the clean CLI guards the real current sources, not only synthetic snippets', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/render-layout-read.mjs', import.meta.url))],
    {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /render\/layout-read AST contract: OK/);
});

test('#1473 the label directive measures only after the render commit', () => {
  assert.deepEqual(inspectLabel(labelText), []);
});
for (const body of ['this.plane.clientWidth;', 'getComputedStyle(this.plane);',
  'this.boundPaint();', 'this["boundPaint"]();', '[1].map(() => this.boundPaint());',
  'const measure = this.boundPaint; measure();']) {
  test(`#1473 render/update cannot perform or borrow post-render measurement: ${body}`, () => {
    for (const entry of ['render', 'update']) {
      const text = labelText.replace(`${entry}(){`, `${entry}(){ ${body}`);
      assert.ok(inspectLabel(text).length, entry);
    }
  });
}
test('#1473 a synchronous helper or getter cannot launder label measurement', () => {
  for (const bridge of ['bridge(){ this.boundPaint(); }', 'get bridge(){ return this["boundPaint"](); }']) {
    assert.ok(inspectLabel(labelText.replace('render(){}', `render(){ this.bridge; } ${bridge}`))
      .some(p => p.includes('synchronously references')));
  }
});
test('#1473 only native deferred callbacks are allowed, not arbitrary callbacks', () => {
  for (const call of ['[1].map', 'this.requestAnimationFrame']) {
    assert.ok(inspectLabel(labelText.replace('requestAnimationFrame(', `${call}(`)).length);
  }
  assert.ok(inspectLabel(labelText.replace('const width =', 'const immediate = this.plane.offsetLeft; const width =')
    .replace('schedule = () => {', 'schedule = () => { this.plane.offsetTop;'))
    .some(p => p.includes('outside post-render measurement')));
});
test('#1473 measurement ownership stays explicit and pure ISO files stay strict', () => {
  assert.ok(inspectLabel(labelText.replace('boundPaint(){', 'renamed(){'))
    .some(p => p.includes('expected one post-render measurement')));
  assert.ok(inspectLabel(labelText.replace('render(){}', 'boundPaint(){} render(){}'))
    .some(p => p.includes('found 2')));
  assert.ok(inspect(summaryText, {isoTexts:[['iso-pure.ts', 'requestAnimationFrame(() => node.clientWidth);']]})
    .some(p => p.startsWith('iso-pure.ts forces layout')));
});
