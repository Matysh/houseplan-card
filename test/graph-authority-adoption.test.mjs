import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfigAdoption } from '../test-build/config-adoption.js';
import { canonicalizeConfigGeometry } from '../test-build/coordinate-canonicalization.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';

const config = (x, title = 'Floor') => ({
  model_version: 11, markers: [], settings: {}, spaces: [{ id: 'floor', title,
    plan_graph: { version: 1, nodes: [
      { id: 'a', p: ['q', '1', '720', '1', '720'] },
      { id: 'b', p: ['q', '1', '2', '1', '720'] },
      { id: 'c', p: ['q', '1', '2', '1', '2'] },
    ], edges: [
      { id: 'ab', kind: 'wall', from: 'a', to: 'b', cm: 15 },
      { id: 'bc', kind: 'wall', from: 'b', to: 'c', cm: 15 },
      { id: 'ca', kind: 'wall', from: 'c', to: 'a', cm: 15 },
    ], rooms: [{ room: 'room', edges: ['ab','bc','ca'].map(id => ({kind:'wall',id,reverse:false})) }], dependencies: [] },
    rooms: [{ id: 'room', name: 'Room', area: null,
      poly: [[x, 1/720], [.5, 1/720], [.5, .5]], wall_ids: ['ab','bc','ca'] }],
    wall_segments: [{ id:'ab', a:[x,1/720],b:[.5,1/720],cm:15 }],
    partitions: [{id:'part',a:[.50000001,.25],b:[.75,.25],cm:15}],
    openings: [{id:'door',x:1/720,y:1/720,host:{kind:'wall',id:'ab',t:1/3,tq:['1','3']}}],
  }],
});

test('current graph carriers survive metadata canonicalization without nine-decimal rounding', () => {
  const original = config(1/720);
  const result = canonicalizeConfigGeometry(original);
  assert.deepEqual(result.spaces[0].rooms, original.spaces[0].rooms);
  assert.deepEqual(result.spaces[0].wall_segments, original.spaces[0].wall_segments);
  assert.deepEqual(result.spaces[0].partitions, original.spaces[0].partitions);
  assert.deepEqual(result.spaces[0].openings, original.spaces[0].openings);
  assert.deepEqual(result.spaces[0].plan_graph, original.spaces[0].plan_graph);
  assert.notEqual(result, original);
});

test('authoritative migration ACK supplies the accepted body and revision', () => {
  const adoption = createConfigAdoption();
  const preview = config(.001388889), authoritative = config(1/720);
  adoption.stageConfigCandidate(preview);
  adoption.acceptConfigWrite(preview, {config:authoritative,rev:7});
  assert.equal(adoption.config, authoritative);
  assert.equal(adoption.configRev, 7);
  assert.equal(adoption.configFingerprint, contentFingerprint(authoritative));
  assert.deepEqual(adoption.snapshot(null).config, authoritative);
});

test('authoritative ACK never overwrites a newer optimistic edit', () => {
  const adoption = createConfigAdoption();
  const sent = config(.001388889), actual = config(1/720), newer = config(.25,'Newer draft');
  adoption.stageConfigCandidate(sent);
  adoption.stageLocalConfig(newer);
  adoption.acceptConfigWrite(sent, {config:actual,rev:8});
  assert.equal(adoption.config, newer);
  assert.equal(adoption.configRev, 8);
  assert.deepEqual(adoption.snapshot(null).config, actual);
});

test('paired migration ACK adopts its actual config and layout together', () => {
  const adoption = createConfigAdoption();
  const sent=config(.001388889),actual=config(1/720),layout={marker:{s:'floor',x:.25,y:.5}};
  adoption.acceptPairWrite(sent, {}, {config:actual,layout,config_rev:9,layout_rev:4});
  assert.equal(adoption.config, actual);
  assert.equal(adoption.layout, layout);
  assert.equal(adoption.configRev, 9);
  assert.equal(adoption.layoutRev, 4);
  assert.deepEqual(adoption.snapshot(null).layout,layout);
});
