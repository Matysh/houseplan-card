/**
 * #617: предел файла плана — одно число, и карточка проверяет его до отправки.
 *
 * Раньше план уходил base64 внутри WebSocket-кадра: файл больше ~3 МиБ давал
 * кадр больше 4 МиБ, Home Assistant закрывал сокет, а обещанные «8 МБ» были
 * недостижимы. Теперь план идёт по HTTP, и предел должен совпадать везде, где
 * его видит человек или проверяет код: TS-константа, `validation.py`, строка
 * «План» в `USER-GUIDE.ru.md` и фраза «Plan files … up to N MB» в
 * `USER-GUIDE.md` (AC6). Браузерная часть — `demo/smoke_plan_upload_limit.mjs`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MAX_PLAN_BYTES, MAX_PLAN_MB, PLAN_UPLOAD_PATH, renderPlanBackdropGuard, stagePlanFile, uploadPlanFile,
} from '../test-build/backdrop-pick.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const pythonPlanLimit = () => {
  const match = read('custom_components/houseplan/validation.py')
    .match(/^MAX_PLAN_BYTES = ([\d\s*]+)$/m);
  assert.ok(match, 'validation.py объявляет MAX_PLAN_BYTES произведением целых');
  return match[1].split('*').map((part) => Number(part.trim())).reduce((a, b) => a * b, 1);
};

test('#617 AC6: предел плана — одно число в TS, Python и обоих USER-GUIDE', () => {
  assert.equal(MAX_PLAN_BYTES, pythonPlanLimit());
  assert.equal(MAX_PLAN_MB, MAX_PLAN_BYTES / 1048576);
  assert.ok(Number.isInteger(MAX_PLAN_MB), 'в тексте предел — целое число МБ');

  const ru = read('docs/USER-GUIDE.ru.md').match(/^\| План \| [^|]+ \| (\d+) МБ \|/m);
  assert.ok(ru, 'USER-GUIDE.ru.md: строка «План» таблицы «Файлы и квоты»');
  assert.equal(Number(ru[1]), MAX_PLAN_MB);

  const en = read('docs/USER-GUIDE.md').match(/Plan files accept [^\n]*? up to (\d+) MB/);
  assert.ok(en, 'USER-GUIDE.md: «Plan files … up to N MB»');
  assert.equal(Number(en[1]), MAX_PLAN_MB);
});

const host = () => ({
  toasts: [],
  _t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
  _showToast(text) { this.toasts.push(text); },
  _backdropGuard: null,
  requestUpdate: () => {},
});

const pngHead = (width, height, pad = 0) => {
  const head = new Uint8Array(33 + pad);
  head.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  head.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(head.buffer).setUint32(16, width);
  new DataView(head.buffer).setUint32(20, height);
  head[24] = 8;
  head[25] = 2;
  return head;
};

test('#617 AC2: SVG больше предела отклоняется при выборе, тост называет предел', async () => {
  const h = host();
  const svg = new File([new Uint8Array(MAX_PLAN_BYTES + 1)], 'plan.svg', { type: 'image/svg+xml' });
  assert.equal(await stagePlanFile(h, svg), null);
  assert.deepEqual(h.toasts, [`toast.plan_too_large ${JSON.stringify({ mb: 8 })}`]);
  assert.equal(h._backdropGuard, null);
});

test('#617 AC3: растр больше предела уходит в диалог #39 без «Оставить оригинал»', async () => {
  const h = host();
  const file = new File([pngHead(1000, 800, MAX_PLAN_BYTES + 1 - 33)], 'scan.png', { type: 'image/png' });
  assert.equal(file.size, MAX_PLAN_BYTES + 1);
  assert.equal(await stagePlanFile(h, file), null);
  assert.equal(h.toasts.length, 0);
  assert.equal(h._backdropGuard?.probe.kind, 'safe');

  const keys = JSON.stringify(renderPlanBackdropGuard(h, () => {}, () => {}, {}));
  assert.ok(!keys.includes('backdrop.keep_original'), 'оригинал больше предела не предлагается');
  assert.ok(keys.includes('backdrop.use_downscaled'));
  assert.ok(keys.includes('backdrop.over_limit_body'));

  // Ровно предел — оригинал снова допустим (граница включительная).
  const exact = new File([pngHead(1000, 800, MAX_PLAN_BYTES - 33)], 'scan.png', { type: 'image/png' });
  h._backdropGuard = { file: exact, ext: 'png', probe: h._backdropGuard.probe, busy: false };
  const exactKeys = JSON.stringify(renderPlanBackdropGuard(h, () => {}, () => {}, {}));
  assert.ok(exactKeys.includes('backdrop.keep_original'));
  assert.ok(!exactKeys.includes('backdrop.over_limit_body'));
});

const payload = () => ({ ext: 'png', blob: new Blob([new Uint8Array([1, 2, 3])]), aspect: 1.5, name: 'p.png' });
const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

test('#617 AC1: загрузка — один POST multipart на новый маршрут, URL из ответа', async () => {
  const calls = [];
  const hass = {
    fetchWithAuth: async (path, init) => {
      calls.push({ path, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, url: '/api/houseplan/content/plans/_/f1.abcd.png' }) };
    },
  };
  const out = await uploadPlanFile(hass, t, 'f1', payload());
  assert.deepEqual(out, { url: '/api/houseplan/content/plans/_/f1.abcd.png' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, PLAN_UPLOAD_PATH);
  assert.equal(PLAN_UPLOAD_PATH, '/api/houseplan/plans/upload');
  const body = calls[0].init.body;
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(body.get('space_id'), 'f1');
  assert.equal(body.get('ext'), 'png');
  assert.deepEqual([...new Uint8Array(await body.get('file').arrayBuffer())], [1, 2, 3]);
});

test('#617 AC5: ответ 413 превращается в текст с пределом, а не в «HTTP 413»', async () => {
  const answer = (status, json) => ({
    fetchWithAuth: async () => ({ ok: false, status, json: async () => { if (json === null) throw new Error('not json'); return json; } }),
  });
  await assert.rejects(uploadPlanFile(answer(413, { error: 'too_large', max_mb: 8 }), t, 'f1', payload()),
    { message: `err.too_large ${JSON.stringify({ mb: 8 })}` });
  // прокси перед HA отвечает 413 без JSON — предел берётся из константы
  await assert.rejects(uploadPlanFile(answer(413, null), t, 'f1', payload()),
    { message: `err.too_large ${JSON.stringify({ mb: MAX_PLAN_MB })}` });
  await assert.rejects(uploadPlanFile(answer(403, { error: 'unauthorized' }), t, 'f1', payload()),
    { message: 'err.unauthorized' });
  await assert.rejects(uploadPlanFile(answer(507, { error: 'too_many_files', detail: 'x' }), t, 'f1', payload()),
    { message: 'too_many_files' });
  await assert.rejects(uploadPlanFile(answer(404, null), t, 'f1', payload()), { message: 'HTTP 404' });
});
