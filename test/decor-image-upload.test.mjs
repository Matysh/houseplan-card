/**
 * #433: путь загрузки декор-картинки под автотестом.
 *
 * До этой задачи `src/backdrop-pick.ts` и `src/decor-image-editor.ts` не
 * входили в `tsconfig.test.json` — юнитов у них не было вовсе, а смоки
 * подменяли `hass.callWS` и до `uploadFromInput`/`upload`/`delete` не
 * доходили. Цена известна: #427 — файл тяжелее 2 МиБ нельзя было добавить
 * ничем, гасли обе кнопки диалога, — прожил четыре круга ревью.
 *
 * Здесь проверяется то, что не требует браузера: классификация файла, состав
 * кнопок диалога-предупреждения и обе сетевые ноги (upload, delete) с
 * подставным транспортом. Браузерная часть — `demo/smoke_decor_images.mjs` и
 * `demo/smoke_backdrop_guard.mjs`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPlanFile, planFileExt, renderBackdropGuard } from '../test-build/backdrop-pick.js';
import { DecorImageEditor } from '../test-build/decor-image-editor.js';

const ASSET_LIMIT = 2 * 1024 * 1024;
const id = (char) => char.repeat(64);

/** PNG ровно до конца IHDR: probeBackdrop читает только заголовок. */
const pngBytes = (width, height, { colourType = 2, pad = 0 } = {}) => {
  const head = new Uint8Array(33 + pad);
  head.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  head.set([0, 0, 0, 13], 8);
  head.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  new DataView(head.buffer).setUint32(16, width);
  new DataView(head.buffer).setUint32(20, height);
  head[24] = 8;
  head[25] = colourType;
  return head;
};

const pngFile = (width, height, options = {}) => new File(
  [pngBytes(width, height, options)], options.name || 'plan.png', { type: 'image/png' },
);

/** i18n-ключи из TemplateResult: `_t` в тестах возвращает сам ключ. */
const keysOf = (template) => {
  const out = [];
  const walk = (value) => {
    if (value == null || typeof value === 'boolean') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value === 'object') {
      if (Array.isArray(value.values)) value.values.forEach(walk);
      return;
    }
    if (typeof value === 'string') out.push(value);
  };
  walk(template);
  return out;
};

const guardHost = (guard) => ({
  _t: (key) => key,
  _showToast: () => {},
  _backdropGuard: guard,
  requestUpdate: () => {},
});

const editorHost = (over = {}) => ({
  _t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
  _errText: (error) => String(error?.message ?? error),
  _showToast(text) { this.toasts.push(text); },
  toasts: [],
  _decorAssetBusy: false,
  _backdropGuard: null,
  _decorAssets: new Map(),
  _decorAssetCatalog: [],
  _decorImagePalette: null,
  _decorShapeDialog: null,
  requestUpdate: () => {},
  hass: {},
  ...over,
});

const editorOf = (host, hooks = {}) => new DecorImageEditor(host, {
  decorSnap: (raw) => raw,
  geometrySnapshot: () => null,
  clearFurniturePreview: () => {},
  recordGeometry: () => {},
  saveConfig: () => {},
  saveShape: () => {},
  setGuardReplace: () => {},
  furnShiftDetach: () => {},
  furnPick: () => {},
  furnFieldValue: (cm) => cm,
  furnFieldToCm: (value) => value,
  ...hooks,
});

const catalogRow = (asset_id = id('a'), over = {}) => ({
  asset_id,
  name: 'plan.png',
  mime: 'image/png',
  width: 100,
  height: 100,
  bytes: 33,
  url: `/api/houseplan/content/assets/_/${asset_id}.png`,
  ...over,
});

// --- классификация ----------------------------------------------------------

test('#433 классификация различает проходной файл, лимит источника и отказ', async () => {
  assert.equal(planFileExt(new File([], 'x.png', { type: 'image/png' })), 'png');
  assert.equal(planFileExt(new File([], 'x.gif', { type: 'image/gif' })), '');

  const small = await classifyPlanFile(pngFile(100, 100), ASSET_LIMIT);
  assert.deepEqual(small, { kind: 'pass', ext: 'png' });

  // Тот же безобидный растр, но тяжелее лимита источника: диалог, а не отказ.
  const heavy = await classifyPlanFile(pngFile(100, 100, { pad: ASSET_LIMIT }), ASSET_LIMIT);
  assert.equal(heavy.kind, 'guard');
  assert.equal(heavy.state.probe.kind, 'safe',
    'файл велик, но безопасен — предупреждение относится к размеру, не к декодированию');

  // Без лимита источника тот же файл проходит: лимит — параметр вызывающего,
  // и именно им подложка отличается от декор-картинки.
  assert.deepEqual(
    await classifyPlanFile(pngFile(100, 100, { pad: ASSET_LIMIT })),
    { kind: 'pass', ext: 'png' },
  );

  const warn = await classifyPlanFile(pngFile(6000, 6000), ASSET_LIMIT);
  assert.equal(warn.state.probe.kind, 'warn');
  const hard = await classifyPlanFile(pngFile(20_000, 100), ASSET_LIMIT);
  assert.equal(hard.state.probe.kind, 'hard');
  const unknown = await classifyPlanFile(
    new File([new Uint8Array(64)], 'x.png', { type: 'image/png' }), ASSET_LIMIT,
  );
  assert.equal(unknown.state.probe.kind, 'unknown');
  assert.deepEqual(await classifyPlanFile(new File([], 'x.gif', { type: 'image/gif' })),
    { kind: 'reject' });
});

// --- состав кнопок диалога --------------------------------------------------

test('#433 состав кнопок диалога-предупреждения для трёх случаев', async () => {
  const guardOf = async (file) => (await classifyPlanFile(file, ASSET_LIMIT)).state;

  // 1. В пределах лимита диалога нет вовсе — его нечем показывать.
  assert.equal(renderBackdropGuard(guardHost(null), () => {}, () => {}, null), null);

  // 2. Свыше лимита источника, декор-картинка: allowOriginal=false.
  //    Это #427 — условие гасило обе кнопки, и «уменьшить копию» тоже.
  const heavy = await guardOf(pngFile(100, 100, { pad: ASSET_LIMIT }));
  const decor = keysOf(renderBackdropGuard(
    guardHost(heavy), () => {}, () => {}, null, async () => {}, false,
  ));
  assert.deepEqual(decor.filter((key) => key.startsWith('btn.') || key.startsWith('backdrop.k')
    || key === 'backdrop.use_downscaled'), ['btn.cancel', 'backdrop.use_downscaled']);
  assert.ok(!decor.includes('backdrop.keep_original'),
    'оригинал тяжелее лимита сохранить нельзя — именно эта кнопка и лишняя');
  assert.ok(decor.includes('backdrop.reduced_dimensions'),
    'размеры уменьшенной копии показываются — иначе предложение непроверяемо');

  // 3. Подложка на том же файле: обе кнопки остаются.
  const backdrop = keysOf(renderBackdropGuard(guardHost(heavy), () => {}, () => {}, null));
  assert.ok(backdrop.includes('backdrop.keep_original'));
  assert.ok(backdrop.includes('backdrop.use_downscaled'));

  // 4. Жёсткий отказ: только «Отмена», ни одного действия.
  const hard = keysOf(renderBackdropGuard(
    guardHost(await guardOf(pngFile(20_000, 100))), () => {}, () => {}, null,
  ));
  assert.ok(hard.includes('backdrop.too_large_title') && hard.includes('backdrop.too_large_body'));
  assert.deepEqual(hard.filter((key) => key.startsWith('btn.')), ['btn.cancel']);
  assert.ok(!hard.includes('backdrop.use_downscaled') && !hard.includes('backdrop.keep_original'));

  // 5. Неизвестный заголовок — предупреждение, а не тихий проход.
  const unknown = keysOf(renderBackdropGuard(
    guardHost((await classifyPlanFile(
      new File([new Uint8Array(64)], 'x.png', { type: 'image/png' }), ASSET_LIMIT,
    )).state), () => {}, () => {}, null,
  ));
  assert.ok(unknown.includes('backdrop.unknown_body'));
  assert.ok(unknown.includes('backdrop.use_downscaled'));
});

// --- uploadFromInput: развилка до сети ---------------------------------------

const changeEvent = (files) => ({ target: { files, value: 'stale-path' } });

test('#433 uploadFromInput чистит input и не ходит в сеть без файла или на занятом', async () => {
  const host = editorHost({ hass: { fetchWithAuth: () => assert.fail('сети быть не должно') } });
  const editor = editorOf(host);
  const empty = changeEvent([]);
  await editor.uploadFromInput(empty);
  assert.equal(empty.target.value, '',
    'путь к файлу обязан сбрасываться: иначе повторный выбор того же файла не даст change');
  assert.deepEqual(host.toasts, []);

  host._decorAssetBusy = true;
  const busy = changeEvent([pngFile(100, 100)]);
  await editor.uploadFromInput(busy);
  assert.equal(busy.target.value, '');
  assert.deepEqual(host.toasts, [], 'занятая загрузка молчит, а не жалуется');
  assert.equal(host._backdropGuard, null);
});

test('#433 uploadFromInput отбивает неподдерживаемый формат и нечитаемый файл', async () => {
  const host = editorHost({ hass: { fetchWithAuth: () => assert.fail('сети быть не должно') } });
  const editor = editorOf(host);
  await editor.uploadFromInput(changeEvent([new File([], 'x.gif', { type: 'image/gif' })]));
  assert.deepEqual(host.toasts, ['toast.plan_formats']);

  host.toasts.length = 0;
  await editor.uploadFromInput(changeEvent([{
    name: 'x.png', type: 'image/png', size: 10,
    arrayBuffer: () => Promise.reject(new Error('boom')),
  }]));
  assert.deepEqual(host.toasts, ['backup.error.invalid_image'],
    'исключение классификации — честный отказ, а не тихий пропуск файла дальше');
  assert.equal(host._backdropGuard, null);
});

test('#433 uploadFromInput передаёт диалогу флаг замены, а не теряет его', async () => {
  for (const replaceSelection of [false, true]) {
    const replaces = [];
    const host = editorHost({ hass: { fetchWithAuth: () => assert.fail('сети быть не должно') } });
    const editor = editorOf(host, { setGuardReplace: (value) => replaces.push(value) });
    await editor.uploadFromInput(
      changeEvent([pngFile(100, 100, { pad: ASSET_LIMIT })]), replaceSelection,
    );
    assert.equal(host._backdropGuard?.probe.kind, 'safe');
    assert.deepEqual(replaces, [replaceSelection],
      'кнопка «уменьшить копию» грузит результат туда же, куда просил вызвавший');
  }
});

// --- upload: сетевая нога ----------------------------------------------------

const uploadHost = (respond, over = {}) => {
  const calls = [];
  const host = editorHost({
    hass: {
      fetchWithAuth: async (url, init) => {
        calls.push({ url, init });
        return respond(calls.length);
      },
    },
    ...over,
  });
  return { host, calls };
};

test('#433 успешная загрузка попадает в каталог, палитру и отпускает busy', async () => {
  const asset = catalogRow();
  const { host, calls } = uploadHost(() => ({ ok: true, json: async () => ({ asset }) }));
  host._decorAssetCatalog = [catalogRow(id('b'))];
  const file = pngFile(100, 100);
  await editorOf(host).upload(file, 'plan.png', false);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/houseplan/assets/upload');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body.get('file')?.name, 'plan.png',
    'файл уходит как multipart-поле file с именем, которое видит бэкенд');
  assert.deepEqual([...host._decorAssets.keys()], [id('a')]);
  assert.deepEqual(host._decorAssetCatalog.map((row) => row.asset_id), [id('a'), id('b')],
    'свежий ассет первым — палитра показывает только что загруженное');
  assert.equal(host._decorImagePalette?.asset_id, id('a'));
  assert.equal(host._decorAssetBusy, false);
  assert.deepEqual(host.toasts, []);
});

test('#433 замена ссылки в диалоге не трогает палитру', async () => {
  const asset = catalogRow();
  const { host } = uploadHost(() => ({ ok: true, json: async () => ({ asset }) }), {
    _decorShapeDialog: { kind: 'image', assetId: id('c') },
  });
  await editorOf(host).upload(pngFile(100, 100), 'plan.png', true);
  assert.equal(host._decorShapeDialog.assetId, id('a'));
  assert.equal(host._decorImagePalette, null, 'замена ссылки не вооружает инструмент рисования');
});

test('#433 каждый код ошибки бэкенда получает свой текст, busy отпускается', async () => {
  const cases = [
    [{ ok: true, body: { error: 'too_large' } }, 'backdrop.too_large_title'],
    [{ ok: true, body: { error: 'capacity_exceeded' } }, 'decor.image_error_capacity'],
    [{ ok: true, body: { error: 'unsupported_image' } }, 'backup.error.unsupported_image'],
    [{ ok: true, body: { error: 'invalid_format' } }, 'backup.error.invalid_image'],
    [{ ok: true, body: { error: 'что-то новое' } }, 'backup.error.io_error'],
    [{ ok: false, body: { asset: catalogRow() } }, 'backup.error.io_error'],
    [{ ok: true, body: {} }, 'backup.error.io_error'],
    // Строка, не прошедшая adoptDecorAssets, — тот же отказ: принять её значило
    // бы положить в каталог запись, которой карточка потом не сможет доверять.
    [{ ok: true, body: { asset: catalogRow(id('a'), { url: 'https://evil/x.png' }) } },
      'backup.error.io_error'],
  ];
  for (const [response, expected] of cases) {
    const { host } = uploadHost(() => ({ ok: response.ok, json: async () => response.body }));
    await editorOf(host).upload(pngFile(100, 100), 'plan.png', false);
    assert.equal(host.toasts.length, 1, JSON.stringify(response));
    assert.ok(host.toasts[0].startsWith('decor.image_upload_failed'), host.toasts[0]);
    assert.ok(host.toasts[0].includes(expected), `${JSON.stringify(response)} → ${host.toasts[0]}`);
    assert.equal(host._decorAssetCatalog.length, 0);
    assert.equal(host._decorImagePalette, null);
    assert.equal(host._decorAssetBusy, false, 'busy обязан отпускаться и на отказе');
  }
});

test('#433 повторный вызов на занятой загрузке не удваивает запрос', async () => {
  // Первый запрос висит, второй ответил бы сразу — то есть на снятой проверке
  // busy тест падает на сравнении, а не зависает: свидетель, который вешает
  // прогон, уносит с собой и остальные тесты файла (проверено).
  let release = () => {};
  const pending = new Promise((resolve) => {
    release = () => resolve({ ok: true, json: async () => ({ asset: catalogRow() }) });
  });
  const { host, calls } = uploadHost((nth) => (nth === 1 ? pending : {
    ok: true, json: async () => ({ asset: catalogRow(id('b')) }),
  }));
  const editor = editorOf(host);
  const first = editor.upload(pngFile(100, 100), 'plan.png', false);
  await editor.upload(pngFile(100, 100), 'second.png', false);
  assert.equal(calls.length, 1, 'вторая загрузка поверх незакончившейся первой запрещена');
  release();
  await first;
  assert.equal(host._decorAssetBusy, false);
  assert.deepEqual(host._decorAssetCatalog.map((row) => row.asset_id), [id('a')]);
});

// --- delete и каталог --------------------------------------------------------

const wsHost = (behaviour, over = {}) => {
  const calls = [];
  const host = editorHost({
    hass: { callWS: async (message) => { calls.push(message); return behaviour(message); } },
    _confirmDanger: async () => true,
    ...over,
  });
  return { host, calls };
};

test('#433 удаление спрашивает подтверждение и уважает отказ', async () => {
  const asset = catalogRow();
  const used = { ...asset, used_by: [{ space_id: 's', decor_id: 'd' }] };
  const inUse = wsHost(() => ({}));
  inUse.host._decorAssetCatalog = [used];
  await editorOf(inUse.host).delete(used);
  assert.deepEqual(inUse.calls, [], 'ассет под ссылкой не удаляется вовсе');
  assert.deepEqual(inUse.host.toasts, ['decor.image_in_use']);

  const declined = wsHost(() => ({}), { _confirmDanger: async () => false });
  declined.host._decorAssetCatalog = [asset];
  await editorOf(declined.host).delete(asset);
  assert.deepEqual(declined.calls, [], 'отказ в подтверждении — это отказ');
  assert.deepEqual(declined.host._decorAssetCatalog, [asset]);
});

test('#433 подтверждённое удаление чистит каталог, карту и палитру', async () => {
  const asset = catalogRow();
  const other = catalogRow(id('b'));
  const { host, calls } = wsHost(() => ({}), {
    _decorAssets: new Map([[id('a'), asset], [id('b'), other]]),
    _decorImagePalette: asset,
  });
  host._decorAssetCatalog = [asset, other];
  await editorOf(host).delete(asset);
  assert.deepEqual(calls, [{ type: 'houseplan/assets/delete', asset_id: id('a') }]);
  assert.deepEqual(host._decorAssetCatalog.map((row) => row.asset_id), [id('b')]);
  assert.deepEqual([...host._decorAssets.keys()], [id('b')]);
  assert.equal(host._decorImagePalette, null,
    'нельзя оставить инструмент вооружённым удалённым ассетом');
});

test('#433 отказ сервера на удалении сохраняет каталог и различает in_use', async () => {
  for (const [error, expected] of [
    [Object.assign(new Error('nope'), { code: 'in_use' }), 'decor.image_in_use'],
    [new Error('boom'), 'backup.error.io_error'],
  ]) {
    const asset = catalogRow();
    const { host } = wsHost(() => { throw error; }, {
      _decorAssets: new Map([[id('a'), asset]]),
      _decorImagePalette: asset,
    });
    host._decorAssetCatalog = [asset];
    await editorOf(host).delete(asset);
    assert.deepEqual(host.toasts, [expected]);
    assert.deepEqual(host._decorAssetCatalog, [asset], 'на отказе каталог не редеет');
    assert.equal(host._decorAssets.size, 1);
    assert.equal(host._decorImagePalette, asset);
  }
});

test('#433 загрузка каталога отбирает валидные строки и не молчит на отказе', async () => {
  const good = catalogRow();
  const { host } = wsHost(() => ({ assets: [good, catalogRow(id('b'), { width: 0 })] }));
  await editorOf(host).loadCatalog();
  assert.deepEqual(host._decorAssetCatalog.map((row) => row.asset_id), [id('a')]);
  assert.deepEqual([...host._decorAssets.keys()], [id('a')]);

  const broken = wsHost(() => { throw new Error('offline'); });
  await editorOf(broken.host).loadCatalog();
  assert.deepEqual(broken.host.toasts, ['backup.error.io_error']);
});
