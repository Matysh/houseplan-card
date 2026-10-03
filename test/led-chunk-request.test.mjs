import assert from 'node:assert/strict';
import test from 'node:test';
import { ledChunkRequestName } from '../demo/performance/led-chunk-request.mjs';

test('#788: LED request accounting recognises names independently of hash delimiters', () => {
  for (const kind of ['runtime', 'field', 'editor']) {
    for (const hash of ['abc123', '-abc123', 'abc-def', 'abc_def', 'a-b_c-d']) {
      const name = `led-strip-${kind}-${hash}.js`;
      for (const url of [name, `http://localhost:8123/dist/${name}`,
        `http://localhost:8123/dist/${name}?retry=1`, `http://localhost:8123/dist/${name}?from=/path`,
        `http://localhost:8123/dist/${name}#module`]) {
        assert.equal(ledChunkRequestName(url), `led-strip-${kind}`, url);
      }
    }
  }
});

test('#788: LED request accounting ignores non-chunks without hiding editor loads', () => {
  for (const name of ['led-strip-geometry-abc.js', 'prefix-led-strip-field-abc.js',
    'led-strip-field-abc.js.map', 'led-strip-field-abc.css', 'led-strip-field-.js',
    'led-strip-field.js', 'houseplan-card.js']) {
    assert.equal(ledChunkRequestName(`http://localhost:8123/dist/${name}`), null, name);
  }
  assert.equal(ledChunkRequestName('http://localhost:8123/dist/led-strip-editor-a-b_c.js'), 'led-strip-editor');
});
