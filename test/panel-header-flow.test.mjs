import assert from 'node:assert/strict';
import test from 'node:test';
import { choosePanelHeader, PanelHeaderMemo, panelHeaderWidth } from '../test-build/panel-header-flow.js';

test('#1120 intrinsic candidates keep strict order and reverse from the full candidate', () => {
  const widths = [970.5, 811.25, 679.75, 599.5];
  const cases = [[1000,0,false], [970.5,0,false], [970.49,1,false],
    [811.25,1,false], [811.24,2,false], [679.75,2,false],
    [679.74,3,false], [599.5,3,false], [599.49,4,false],
    [410.25,4,false], [410.24,4,true]];
  for (const [available,phase,phone] of [...cases,...cases.toReversed()])
    assert.deepEqual(choosePanelHeader(available,widths,410.25),{phase,phone});
});

test('#1120 widths depend on real content, including nonmonotone candidates and exact fractions', () => {
  assert.deepEqual(choosePanelHeader(800,[900,780,790,600],500),{phase:1,phone:false});
  assert.deepEqual(choosePanelHeader(800,[790,780,700,600],500),{phase:0,phone:false});
  assert.deepEqual(choosePanelHeader(800,[NaN,Infinity,800.0001,800],500),{phase:3,phone:false});
  assert.deepEqual(choosePanelHeader(320,[1000,900,800,700],321),{phase:4,phone:true});
  assert.deepEqual(choosePanelHeader(359,[1000,900,800,700],359),{phase:4,phone:false});
});

test('#1120 memo measures only changed owner, semantic content, fractional width or font invalidation', () => {
  const memo = new PanelHeaderMemo(), a = {}, b = {};
  let calls = 0;
  const measure = () => ({phase: ++calls % 4,phone:false,height:64 + calls});
  const first = memo.resolve(a,'ru/floor A/editor',1024.25,measure);
  assert.equal(memo.resolve(a,'ru/floor A/editor',1024.25,measure),first);
  assert.equal(calls,1,'unchanged visual ticks borrow the same measurement');
  memo.resolve(a,'ru/floor A/editor',1024.26,measure); assert.equal(calls,2);
  memo.resolve(a,'en/floor A/editor',1024.26,measure); assert.equal(calls,3);
  memo.resolve(a,'en/floor B/view',1024.26,measure); assert.equal(calls,4);
  memo.resolve(b,'en/floor B/view',1024.26,measure); assert.equal(calls,5);
  memo.invalidate();
  memo.resolve(b,'en/floor B/view',1024.26,measure); assert.equal(calls,6);
  memo.clear();
  memo.resolve(b,'en/floor B/view',1024.26,measure); assert.equal(calls,7);
});

test('#1120 allocated head uses fractional untransformed border-box space, not its wider owner', () => {
  const old = globalThis.getComputedStyle;
  const head = { getBoundingClientRect() { throw Error('transformed rect is not a fit budget'); } };
  try {
    globalThis.getComputedStyle = () => ({width:'920.25px',boxSizing:'border-box',
      paddingLeft:'12px',paddingRight:'12px',borderLeftWidth:'0px',borderRightWidth:'0px'});
    assert.equal(panelHeaderWidth(head),920.25);
    globalThis.getComputedStyle = () => ({width:'896.25px',boxSizing:'content-box',
      paddingLeft:'12px',paddingRight:'12px',borderLeftWidth:'0px',borderRightWidth:'0px'});
    assert.equal(panelHeaderWidth(head),920.25);
  } finally {
    if (old === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = old;
  }
});
