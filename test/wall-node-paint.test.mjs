import test from 'node:test';
import assert from 'node:assert/strict';
import { WallNodeEditor } from '../test-build/wall-node-editor.js';

function setup() {
  const log = [], view = new EventTarget();
  view.getComputedStyle = element => {
    log.push(['flush', element.name, element.style.opacity, element.style.transition]);
    return { opacity: element.style.opacity };
  };
  const context = { enabled: true, api: true, space: 'f', revision: 1 };
  const capture = { style: {}, hasPointerCapture: () => false };
  const editor = new WallNodeEditor({ document: { defaultView: view },
    context: () => context, root: () => ({ querySelector: () => null }), changed() {} });
  function element(name, original = {}, connected = true, normalize = value => value) {
    const values = { mask: '', opacity: '', transition: '', ...original };
    const style = {};
    for (const property of ['mask', 'opacity', 'transition']) Object.defineProperty(style, property, {
      get: () => values[property], set: value => {
        log.push(['write', name, property, value]); values[property] = normalize(value, property);
      },
    });
    return { name, style, isConnected: connected };
  }
  return { editor, log, element, view, context,
    active() { editor.session = { pointer: 1, capture, revision: 1, plan: { source: { id: 'f' } } }; },
    sync(entries) { editor.syncPaint(new Map(entries)); },
    reset() { log.length = 0; } };
}

test('steady node source overrides cause no style writes or computed-style reads', () => {
  const s = setup(), room = s.element('room', { opacity: '.7', transition: 'opacity 200ms' });
  const wall = s.element('wall', { mask: 'url(#original)' }), handle = s.element('handle');
  const desired = [[room, { transition: 'none', opacity: '0' }],
    [wall, { mask: 'url(#hp-node-old-walls-mask)' }], [handle, { opacity: '0' }]];
  s.sync(desired);
  assert.deepEqual(s.log.slice(0, 2), [['write', 'room', 'transition', 'none'], ['write', 'room', 'opacity', '0']]);
  assert.equal(s.log.filter(e => e[0] === 'flush').length, 0);
  s.reset();
  for (let i = 0; i < 60; i++) s.sync(desired);
  assert.deepEqual(s.log, []);
  assert.equal(s.editor.touched.size, 3);
  s.sync([]);
  assert.equal(room.style.opacity, '.7'); assert.equal(room.style.transition, 'opacity 200ms');
  assert.equal(wall.style.mask, 'url(#original)'); assert.equal(handle.style.opacity, '');
  assert.equal(s.editor.touched.size, 0);
});

test('CSSOM-normalized override values are stable and never replace originals', () => {
  const s = setup(), wall = s.element('wall', { mask: 'url("#source")' }, true,
    (value, property) => property === 'mask' ? value.replace(/url\(#([^)]*)\)/g, 'url("#$1")') : value);
  s.sync([[wall, { mask: 'url(#preview)' }]]);
  assert.equal(wall.style.mask, 'url("#preview")');
  s.reset(); s.sync([[wall, { mask: 'url(#preview)' }]]);
  assert.deepEqual(s.log, []);
  s.sync([]); assert.equal(wall.style.mask, 'url("#source")');
});

test('valid-invalid-valid masks switch directly without a restored intermediate source', () => {
  const s = setup(), wall = s.element('wall', { mask: 'url(#original)' });
  const room = s.element('room', { opacity: '.6', transition: 'opacity 150ms' });
  s.sync([[wall, { mask: 'url(#valid)' }], [room, { opacity: '0', transition: 'none' }]]);
  s.reset(); s.sync([[wall, { mask: 'url(#ghost)' }]]);
  assert.deepEqual(s.log.filter(e => e[1] === 'wall'), [['write', 'wall', 'mask', 'url(#ghost)']]);
  assert.deepEqual(s.log.filter(e => e[0] === 'flush'), [['flush', 'room', '.6', 'none']]);
  assert.equal(room.style.transition, 'opacity 150ms');
  s.reset(); s.sync([[wall, { mask: 'url(#valid)' }], [room, { opacity: '0', transition: 'none' }]]);
  assert.equal(s.log.filter(e => e[0] === 'flush').length, 0);
  s.sync([]);
  assert.equal(wall.style.mask, 'url(#original)'); assert.equal(room.style.opacity, '.6');
});

test('departing room overrides restore opacity before one shared transition barrier', () => {
  const s = setup(), rooms = [s.element('a', { opacity: '.4', transition: 'opacity 1s' }),
    s.element('b', { opacity: '.8', transition: 'all 2s' })];
  s.sync(rooms.map(room => [room, { opacity: '0', transition: 'none' }]));
  s.reset(); s.sync([]);
  const flush = s.log.findIndex(e => e[0] === 'flush');
  assert.equal(s.log.filter(e => e[0] === 'flush').length, 1);
  assert.ok(rooms.every(room => s.log.findIndex(e => e[0] === 'write' && e[1] === room.name && e[2] === 'opacity') < flush));
  assert.ok(rooms.every(room => s.log.findIndex(e => e[0] === 'write' && e[1] === room.name && e[2] === 'transition') > flush));
  s.reset(); s.sync([]); assert.deepEqual(s.log, []);
});

test('original none transitions and unchanged restored opacity need no layout barrier', () => {
  const s = setup(), room = s.element('room', { opacity: '.5', transition: 'none' });
  const hidden = s.element('hidden', { opacity: '0', transition: 'opacity 1s' });
  s.sync([[room, { opacity: '0', transition: 'none' }], [hidden, { opacity: '0', transition: 'none' }]]);
  s.reset(); s.sync([]);
  assert.equal(room.style.opacity, '.5'); assert.equal(hidden.style.transition, 'opacity 1s');
  assert.equal(s.log.filter(e => e[0] === 'flush').length, 0);
});

test('full host render inline updates are reapplied and retained as authoritative originals', () => {
  const s = setup(), room = s.element('room', { mask: 'url(#a)', opacity: '.4', transition: 'opacity 1s' });
  const desired = [[room, { opacity: '0', transition: 'none' }]];
  s.sync(desired);
  room.style.opacity = '.8'; room.style.transition = 'opacity 2s'; room.style.mask = 'url(#host)';
  s.reset(); s.sync(desired);
  assert.equal(room.style.opacity, '0'); assert.equal(room.style.transition, 'none');
  assert.equal(room.style.mask, 'url(#host)', 'unowned host properties remain untouched');
  assert.equal(s.log.filter(e => e[0] === 'flush').length, 0);
  s.sync([]);
  assert.equal(room.style.opacity, '.8'); assert.equal(room.style.transition, 'opacity 2s');
  assert.equal(room.style.mask, 'url(#host)');
});

test('host writes just before terminal cleanup are not overwritten by stale originals', () => {
  const s = setup(), wall = s.element('wall', { mask: 'url(#old)' });
  const room = s.element('room', { opacity: '.4', transition: 'opacity 1s' });
  s.sync([[wall, { mask: 'url(#preview)' }], [room, { opacity: '0', transition: 'none' }]]);
  wall.style.mask = 'url(#latest)'; room.style.opacity = '.9'; room.style.transition = 'opacity 3s';
  s.reset(); s.sync([]);
  assert.deepEqual(s.log, []);
  assert.equal(wall.style.mask, 'url(#latest)'); assert.equal(room.style.opacity, '.9');
  assert.equal(room.style.transition, 'opacity 3s');
});

test('replaced detached SVG elements restore independently without layout and do not accumulate', () => {
  const s = setup(); let old = s.element('initial', { opacity: '.4', transition: 'opacity 1s' });
  s.sync([[old, { opacity: '0', transition: 'none' }]]);
  for (let i = 0; i < 20; i++) {
    old.isConnected = false;
    const fresh = s.element(`replacement-${i}`, { opacity: '.4', transition: 'opacity 1s' });
    s.reset(); s.sync([[fresh, { opacity: '0', transition: 'none' }]]);
    assert.equal(old.style.opacity, '.4'); assert.equal(old.style.transition, 'opacity 1s');
    assert.equal(fresh.style.opacity, '0'); assert.equal(s.editor.touched.size, 1);
    assert.equal(s.log.filter(e => e[0] === 'flush').length, 0);
    old = fresh;
  }
  s.sync([]); assert.equal(old.style.opacity, '.4'); assert.equal(s.editor.touched.size, 0);
});

test('override ownership can change properties without adopting previous preview styles', () => {
  const s = setup(), element = s.element('mixed', { mask: 'url(#source)', opacity: '.5' });
  s.sync([[element, { mask: 'url(#candidate)' }]]);
  s.sync([[element, { opacity: '0' }]]);
  assert.equal(element.style.mask, 'url(#source)'); assert.equal(element.style.opacity, '0');
  s.sync([[element, { mask: 'url(#ghost)' }]]);
  assert.equal(element.style.opacity, '.5');
  s.sync([]); assert.equal(element.style.mask, 'url(#source)'); assert.equal(element.style.opacity, '.5');
});

test('cancel, disposal, pagehide, stale context and missing SVG all restore node source styles', () => {
  for (const terminal of ['cancel', 'dispose', 'pagehide', 'stale-context', 'missing-svg', 'no-session']) {
    const s = setup(), room = s.element('room', { opacity: '.6', transition: 'opacity 200ms' });
    s.active(); s.sync([[room, { opacity: '0', transition: 'none' }]]);
    if (terminal === 'cancel') s.editor.cancel();
    else if (terminal === 'dispose') s.editor.dispose();
    else if (terminal === 'pagehide') s.view.dispatchEvent(new Event('pagehide'));
    else if (terminal === 'stale-context') { s.context.revision++; s.editor.paint(); }
    else if (terminal === 'missing-svg') s.editor.paint();
    else { s.editor.session = null; s.editor.paint(); }
    assert.equal(room.style.opacity, '.6', terminal); assert.equal(room.style.transition, 'opacity 200ms', terminal);
    assert.equal(s.editor.touched.size, 0, terminal);
    s.editor.dispose();
  }
});
