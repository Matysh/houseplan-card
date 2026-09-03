/**
 * #446: конвертер Sweet Home 3D → документ импорта House Plan.
 *
 * Здесь проверяется наша половина цепочки: чтение `.sh3d` и маппинг. Вторая
 * половина — что полученный документ принимают настоящие `CONFIG_SCHEMA` и
 * путь предпросмотра импорта — живёт в `tests_backend/test_sh3d_convert.py`
 * и `tests_backend/test_ha_sh3d_convert.py`. Разрыв между этими половинами и
 * есть тот дрейф версий, из-за которого инструмент на сайте гниёт незаметно.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { readSh3d, parseHomeXml, openingKind } from '../scripts/sh3d-convert/sh3d.mjs';
import {
  ConvertError, MODEL_VERSION, canonicalizeLattice, convertHome, pickCellCm, wallKey,
} from '../scripts/sh3d-convert/convert.mjs';
import { XmlError, parseXml } from '../scripts/sh3d-convert/xml.mjs';
import { ZipError, readZipEntry } from '../scripts/sh3d-convert/zip.mjs';

const NOW = '1970-01-01T00:00:00Z';
const TOOL = 'sh3d-convert 0.1';
const bytes = (name) =>
  new Uint8Array(readFileSync(fileURLToPath(
    new URL(`../scripts/sh3d-convert/fixtures/${name}`, import.meta.url))));
const golden = (name) => JSON.parse(readFileSync(fileURLToPath(
  new URL(`../scripts/sh3d-convert/golden/${name}`, import.meta.url)), 'utf8'));
const convert = async (name) =>
  convertHome(await readSh3d(bytes(name)), { now: NOW, toolVersion: TOOL });

test('#446 квартира из двух комнат: контуры по граням стен становятся общей стеной', async () => {
  // Главное геометрическое решение конвертера. Sweet Home 3D обводит комнаты по
  // внутренним граням, поэтому «как есть» две комнаты дали бы две параллельные
  // стены вместо одной общей, а сервер не смог бы склеить сегмент с двумя
  // владельцами. Вершины привязываются к осевым линиям и сваривются.
  const { documents, report } = await convert('flat-two-rooms.sh3d');
  assert.equal(documents.length, 1);
  const space = documents[0].payload.config.spaces[0];
  assert.deepEqual(space.rooms.map((room) => room.name), ['Кухня', 'Спальня']);
  assert.equal(space.walls.length, 7, 'четыре внешних, одна общая, две половины стены — 7 рёбер');
  const shared = space.rooms[0].poly.filter((point) =>
    space.rooms[1].poly.some((other) => other[0] === point[0] && other[1] === point[1]));
  assert.equal(shared.length, 2, 'общая граница должна совпасть точка-в-точку');
  assert.equal(report.levels[0].notes.find((note) => note.code === 'vertices_snapped').count, 8);
  assert.deepEqual(space.openings.map((opening) => opening.type), ['door', 'window']);
});

test('#446 проём кладётся на ребро, а угол берётся у ребра, не из файла', async () => {
  // Хостинг на сервере допускает 8° расхождения и 0.02 шага решётки по
  // расстоянию. Угол из `.sh3d` в этих единицах доверия не заслуживает,
  // поэтому он вычисляется по ребру, а центр проецируется на него.
  const { documents } = await convert('flat-two-rooms.sh3d');
  const space = documents[0].payload.config.spaces[0];
  const [door, window] = space.openings;
  // В фикстуре у двери объявлен угол 0° на вертикальной стене, у окна — 33° на
  // горизонтальной. Оба значения обязаны быть проигнорированы.
  assert.equal(door.x, 0.5, 'дверь на общей стене x=0.5');
  assert.ok(Math.abs(Math.abs(door.angle) - 90) < 1e-9, `вертикальное ребро → ±90°, а не ${door.angle}`);
  assert.equal(window.angle, 0, 'горизонтальное ребро → 0°');
  assert.ok(door.length > 0 && door.length < 0.34, 'длина в нормализованных единицах');
  // 90 см при клетке 5 см: 90 / (5 * 240) = 0.075
  assert.equal(door.length, 0.075);
});

test('#446 уровни разъезжаются по документам, несжатый zip читается', async () => {
  const { documents } = await convert('two-levels.sh3d');
  assert.equal(documents.length, 2);
  assert.deepEqual(documents.map((doc) => doc.payload.config.spaces[0].title), ['Ground', 'First']);
  assert.equal(documents[0].kind, 'space');
  assert.equal(documents[0].model_version, MODEL_VERSION);
  assert.deepEqual(documents[0].payload.config.markers, []);
  assert.deepEqual(documents[0].payload.layout, {});
  assert.deepEqual(documents[0].placement_manifest, []);
  assert.deepEqual(documents[0].content_manifest, []);
  assert.deepEqual(documents[0].transfer, { plan_only: true });
});

test('#446 кривые случаи попадают в отчёт, а не в тишину', async () => {
  const { documents, report } = await convert('awkward.sh3d');
  assert.equal(documents.length, 1, 'уровень без комнат конвертировать нечем');
  const codes = report.levels[0].notes.map((note) => note.code);
  for (const code of [
    'room_without_polygon', 'curved_wall_straightened', 'thickness_clamped',
    'vertices_snapped', 'edge_without_wall', 'opening_unhosted',
  ]) {
    assert.ok(codes.includes(code), `${code} обязан быть в отчёте: ${codes.join(', ')}`);
  }
  assert.ok(report.items.some((item) => item.code === 'level_without_rooms'));
  assert.ok(report.items.some((item) => item.code === 'furniture_dropped'),
    'мебель не читается вовсе — человек обязан узнать это из отчёта, а не из плана');
  const space = documents[0].payload.config.spaces[0];
  assert.ok(space.walls.every((wall) => wall.cm >= 1 && wall.cm <= 100), 'толщина в пределах схемы');
  // Проём шире ребра обрезается до ребра: иначе сервер откажется его привязать,
  // потому что хост требует, чтобы проём лежал в сегменте целиком.
  assert.ok(codes.includes('opening_shortened'), `opening_shortened: ${codes.join(', ')}`);
  const [wide] = space.openings;
  const edge = space.walls.find((wall) => wall.a[1] === wide.y && wall.b[1] === wide.y);
  assert.ok(edge, 'обрезанный проём лежит на горизонтальном ребре');
  const span = Math.abs(edge.b[0] - edge.a[0]);
  assert.ok(Math.abs(wide.length - span) < 1e-9, `длина ${wide.length} обязана равняться ребру ${span}`);
});

test('#446 общая граница без стены сваривается из шумных вершин', async () => {
  // Sweet Home 3D набирают мышью, и общая граница двух зон приезжает как 400.4
  // против 399.7. Без сварки это два сегмента по одному владельцу вместо одного
  // с двумя, то есть двойная стена там, где стены нет вовсе.
  const { documents } = await convert('noisy-shared-edge.sh3d');
  const space = documents[0].payload.config.spaces[0];
  const [left, right] = space.rooms;
  const shared = left.poly.filter((point) =>
    right.poly.some((other) => other[0] === point[0] && other[1] === point[1]));
  assert.equal(shared.length, 2, 'граница обязана совпасть точка-в-точку');
  assert.equal(space.walls.length, 6, 'четыре внешние стены плюс две половины — общей стены нет');
});

test('#446 golden совпадает с прогоном конвертера', async () => {
  // Golden читает питоновский гейт: он проверяет их настоящей схемой. Правка
  // конвертера без пересборки golden — красный тест здесь; правка golden руками
  // — красный тест там.
  for (const [fixture, files] of [
    ['flat-two-rooms.sh3d', ['flat-two-rooms.space-1.json']],
    ['two-levels.sh3d', ['two-levels.space-1.json', 'two-levels.space-2.json']],
    ['noisy-shared-edge.sh3d', ['noisy-shared-edge.space-1.json']],
    ['awkward.sh3d', ['awkward.space-1.json']],
  ]) {
    const { documents } = await convert(fixture);
    assert.equal(documents.length, files.length, fixture);
    files.forEach((file, index) => {
      assert.deepEqual(documents[index], golden(file),
        `${file} разошёлся с прогоном: пересоберите`
        + ' node scripts/sh3d-convert/cli.mjs … --out scripts/sh3d-convert/golden');
    });
  }
});

test('#446 отказ вместо догадки', async () => {
  await assert.rejects(() => readSh3d(new Uint8Array([1, 2, 3])),
    (error) => error instanceof ZipError && error.code === 'not_zip');
  const flat = bytes('flat-two-rooms.sh3d');
  await assert.rejects(() => readZipEntry(flat, 'Nope.xml'),
    (error) => error.code === 'entry_missing');
  // XXE и «миллион смешков»: объявления сущностей отвергаются, DTD не грузится.
  assert.throws(() => parseXml('<!DOCTYPE home [<!ENTITY a "b">]><home/>'),
    (error) => error instanceof XmlError && error.code === 'entity_declaration');
  assert.throws(() => parseXml('<home name="&evil;"/>'),
    (error) => error.code === 'entity_reference');
  assert.equal(parseXml("<!DOCTYPE home SYSTEM 'x.dtd'><home name='a'/>").attrs.name, 'a');
  // План без комнат: House Plan строит геометрию по комнатам, и это отказ.
  const wallsOnly = parseHomeXml(
    "<home name='w'><wall id='w1' xStart='0' yStart='0' xEnd='100' yEnd='0' thickness='10'/></home>");
  assert.throws(() => convertHome(wallsOnly, { now: NOW }),
    (error) => error instanceof ConvertError && error.code === 'nothing_to_convert');
  // Слишком сложная комната — предел схемы, а не наш вкус.
  const points = Array.from({ length: 501 }, (_, index) =>
    `<point x='${index}' y='${index % 2 ? 10 : 0}'/>`).join('');
  const huge = parseHomeXml(`<home name='h'><room id='r'>${points}</room></home>`);
  assert.throws(() => convertHome(huge, { now: NOW }),
    (error) => error.code === 'room_too_complex');
  // Не метрические единицы: пересчёт был бы догадкой.
  assert.throws(() => convertHome({ ...wallsOnly, unit: 'inch' }, { now: NOW }),
    (error) => error.code === 'unit_not_metric');
});

test('#446 порты серверных формул совпадают с питоном', () => {
  // Эти же значения проверяются в tests_backend/test_sh3d_convert.py настоящими
  // _wall_key и canonicalize_lattice_coordinate. Расхождение формул означает,
  // что толщина стен не найдётся, — и краснеет один из двух тестов.
  assert.equal(wallKey([0.25, 0.3333333333333333], [0.5, 0.3333333333333333]),
    '0.375000,0.333333@0.0000');
  assert.equal(wallKey([0.5, 0.3333333333333333], [0.5, 0.6666666666666666]),
    '0.500000,0.500000@1.5706');
  assert.equal(canonicalizeLattice(0.2499999), 0.25);
  assert.equal(canonicalizeLattice(0.123456789012), 0.123456789);
  assert.equal(pickCellCm(600), 5);
  assert.equal(pickCellCm(2400), 20);
  assert.equal(openingKind({ catalogId: 'eTeks#fixedWindow85x123', name: '' }), 'window');
  assert.equal(openingKind({ catalogId: 'eTeks#doorFrame', name: 'Дверь' }), 'door');
  assert.equal(openingKind({ catalogId: '', name: 'Окно в сад' }), 'window');
});
