/**
 * #446: страница /convert как артефакт.
 *
 * Проверяется не вид, а три обещания, каждое из которых можно нарушить молча:
 * собранный файл действительно содержит рабочий конвертер, он не делает ни
 * одного сетевого вызова, и он не отстал от исходников.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { TEXT } from '../scripts/sh3d-convert/page/app.mjs';

const root = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const page = () => readFileSync(root('scripts/sh3d-convert/dist/index.html'), 'utf8');
const shell = () => readFileSync(root('scripts/sh3d-convert/page/shell.html'), 'utf8');

test('#446 собранная страница не отстала от исходников', () => {
  // Артефакт коммитится, потому что его раскладывают копированием. Значит он
  // умеет отстать — и тогда сайт конвертирует не тем кодом, который проверен
  // гейтами. Сверка с пересборкой это ловит.
  const run = spawnSync(process.execPath,
    [root('scripts/sh3d-convert/build-page.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout || ''}${run.stderr || ''}`);
});

test('#446 в странице нет ни одного сетевого вызова и ни одной внешней загрузки', () => {
  // Обещание «файл не покидает браузер» обязано быть проверяемым, а не
  // написанным в тексте страницы. Заодно поэтому же на странице системные
  // шрифты: <link> к шрифтам — это внешний запрос при загрузке.
  const text = page();
  // Ищутся формы ВЫЗОВА, а не имена: первая редакция теста краснела на
  // собственном комментарии в app.mjs, где эти API перечислены как запрещённые.
  // Документация, называющая запрет, — не нарушение запрета.
  for (const forbidden of [
    /\bfetch\s*\(/, /new\s+XMLHttpRequest/, /new\s+WebSocket/, /new\s+EventSource/,
    /\.sendBeacon\s*\(/, /\bimportScripts\s*\(/, /navigator\.(?:connection|geolocation)/,
    /fonts\.googleapis/, /fonts\.gstatic/, /\bnavigator\.sendBeacon/,
  ]) {
    assert.ok(!forbidden.test(text), `в странице появилось ${forbidden}`);
  }
  assert.ok(!/<script[^>]+src=/i.test(text), 'внешний скрипт');
  assert.ok(!/<link[^>]+href="https?:/i.test(text), 'внешний стиль или шрифт');
  assert.ok(!/url\(\s*['"]?https?:/i.test(text), 'внешний ресурс в CSS');
  // Ссылки, по которым человек ЩЁЛКАЕТ сам, — не запросы: они законны.
  assert.ok(text.includes('href="https://github.com/Matysh/houseplan-card"'));
});

test('#446 конвертер внутри страницы даёт тот же результат, что и модули', async () => {
  // Самое важное: страница собирается склейкой, и склейка может тихо потерять
  // функцию. Поэтому проверяется не текст, а поведение — прогон фикстуры через
  // код, извлечённый из собранного артефакта.
  const text = page();
  const script = /<script type="module">([\s\S]*?)<\/script>/.exec(text);
  assert.ok(script, 'в странице нет модульного скрипта');
  const dir = mkdtempSync(join(tmpdir(), 'hp-convert-page-'));
  try {
    const source = `${script[1].replace(/\nmount\(\);\s*$/, '\n')}\nexport { convertHome, readSh3d };\n`;
    const file = join(dir, 'bundle.mjs');
    writeFileSync(file, source);
    const bundle = await import(pathToFileURL(file).href);
    const bytes = new Uint8Array(readFileSync(root('scripts/sh3d-convert/fixtures/flat-two-rooms.sh3d')));
    const home = await bundle.readSh3d(bytes);
    const { documents } = bundle.convertHome(home, {
      now: '1970-01-01T00:00:00Z', toolVersion: 'sh3d-convert 0.1',
    });
    const golden = JSON.parse(
      readFileSync(root('scripts/sh3d-convert/golden/flat-two-rooms.space-1.json'), 'utf8'));
    assert.deepEqual(documents[0], golden, 'страница конвертирует иначе, чем модули репозитория');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#446 переводы полны: пустых подписей на странице быть не может', () => {
  const keys = [...shell().matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(keys.length >= 15, `подписей всего ${keys.length} — разметка развалилась?`);
  for (const key of new Set(keys)) {
    for (const language of ['ru', 'en']) {
      assert.ok(TEXT[language][key], `${language}: нет перевода для ${key}`);
    }
  }
  assert.deepEqual(Object.keys(TEXT.ru).sort(), Object.keys(TEXT.en).sort(),
    'словари разъехались: часть страницы останется на другом языке');
  // Коды отчёта и отказов тоже переводятся: иначе человек увидит `not_zip`.
  for (const code of [
    'vertices_snapped', 'curved_wall_straightened', 'thickness_clamped',
    'edge_without_wall', 'opening_unhosted', 'opening_shortened',
    'opening_without_width', 'room_without_polygon', 'room_collapsed',
    'level_without_rooms', 'furniture_dropped',
  ]) {
    assert.ok(TEXT.ru[`note.${code}`] && TEXT.en[`note.${code}`], `нет текста для note.${code}`);
  }
  for (const code of [
    'not_zip', 'entry_missing', 'encrypted', 'zip64', 'entry_too_large',
    'entity_declaration', 'entity_reference', 'nothing_to_convert',
    'room_too_complex', 'unit_not_metric', 'file_too_large', 'unknown',
  ]) {
    assert.ok(TEXT.ru[`code.${code}`] && TEXT.en[`code.${code}`], `нет текста для code.${code}`);
  }
});
