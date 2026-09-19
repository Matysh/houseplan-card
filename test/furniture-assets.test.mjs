import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { GENERATED_FURNITURE_CATALOG } from '../test-build/furniture-plan-catalog.generated.js';
import { GENERATED_FURNITURE_ART } from '../test-build/furniture-plan-art.generated.js';
import { FURNITURE } from '../test-build/furniture.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'furniture', 'houseplan-0.4.0', 'pack.json'), 'utf8'));

test('the vendored designer pack and generated modules stay in sync', () => {
  const result = spawnSync(process.execPath, ['scripts/generate-furniture-assets.mjs', '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /60 plan symbols, 33 menu icons/);
});

test('the designer pack has the reviewed cardinality and operations', () => {
  assert.equal(GENERATED_FURNITURE_CATALOG.length, 60);
  // #474: catalogue ids and lazy artwork keys are the same set.
  assert.deepEqual(Object.keys(GENERATED_FURNITURE_ART).sort(), GENERATED_FURNITURE_CATALOG.map((s) => s.id).sort());
  assert.equal(MANIFEST.menu_icons.length, 33);
  assert.equal(MANIFEST.symbols.filter((s) => s.operation === 'replace').length, 56);
  assert.equal(MANIFEST.symbols.filter((s) => s.operation === 'add').length, 4);
  // #593: библиотека РАВНА каталогу. Пока рядом жили 12 примитивов, она была
  // объединением, и это объединение имело цену — см. следующий тест.
  assert.equal(FURNITURE.length, 60);
});

// #593 AC2: пакет 0.4.0 перерисовывает 56 существующих публичных ID и добавляет
// ровно четыре. Ни один сохранённый план не должен потерять свой символ.
test('every public id of pack 0.3.0 survives, and exactly four are new', () => {
  const RETIRED_PRIMITIVES = [
    'fridge', 'dishwasher', 'washer', 'dryer', 'ac', 'water_heater',
    'shower', 'sink', 'stairs', 'fireplace', 'plant', 'rug',
  ];
  const ids = new Set(FURNITURE.map((symbol) => symbol.id));
  // 12 идентификаторов, которые до #593 рисовались примитивами в стартовом графе
  for (const id of RETIRED_PRIMITIVES) assert.equal(ids.has(id), true, id);
  for (const id of ['sofa', 'bed_double', 'wall_unit', 'toilet_built_in']) assert.equal(ids.has(id), true, id);
  assert.deepEqual(MANIFEST.symbols.filter((s) => s.operation === 'add').map((s) => s.id).sort(),
    ['cactus', 'computer', 'hood', 'oven']);
});

// #593 AC2/AC5: ловушка, ради которой примитивы удалены целиком. Обе половины
// прежнего союза несли ОДНИ И ТЕ ЖЕ публичные ID, а `BY_ID` оставлял последнюю
// запись — примитив молча побеждал дизайнерский рисунок, который его заменял.
test('the catalogue has no duplicate ids', () => {
  const ids = FURNITURE.map((symbol) => symbol.id);
  assert.equal(new Set(ids).size, ids.length,
    `дубликаты: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
});

// #593 AC3: `cactus` живёт в категории «Растение», а не «Тренажёр»: плитка
// категории рисует тренажёр, и открывать её на кактус — врать о содержимом.
test('every category tile opens onto its own symbols, and cactus is a plant', () => {
  const categories = new Set(FURNITURE.map((symbol) => symbol.category));
  const menuIds = new Set(MANIFEST.menu_icons.map((icon) => icon.id));
  const byMenuId = new Map(MANIFEST.menu_icons.map((icon) => [icon.id, icon]));
  for (const symbol of MANIFEST.symbols) {
    assert.equal(menuIds.has(symbol.menu_icon), true, `${symbol.id} → ${symbol.menu_icon}`);
    assert.equal(byMenuId.get(symbol.menu_icon).group, symbol.group, symbol.id);
  }
  assert.equal(MANIFEST.symbols.find((s) => s.id === 'cactus').menu_icon, 'plant');
  assert.equal(categories.has('exercise'), false, 'категория тренажёра пуста и потому скрыта');
  assert.equal(categories.size, 32);
  for (const id of ['computer', 'oven', 'hood']) assert.equal(categories.has(id), true, id);
});

test('front-view menu artwork is reachable only through the lazy editor graph', () => {
  const card = fs.readFileSync(path.join(ROOT, 'src', 'houseplan-card.ts'), 'utf8');
  const furniture = fs.readFileSync(path.join(ROOT, 'src', 'furniture.ts'), 'utf8');
  const runtime = fs.readFileSync(path.join(ROOT, 'src', 'houseplan-editor-runtime.ts'), 'utf8');
  const decorImageEditor = fs.readFileSync(path.join(ROOT, 'src', 'decor-image-editor.ts'), 'utf8');
  assert.doesNotMatch(card, /furniture-menu-art\.generated/);
  assert.doesNotMatch(furniture, /furniture-menu-art\.generated/);
  assert.match(runtime, /from '\.\/decor-image-editor'/);
  assert.match(decorImageEditor, /from '\.\/furniture-menu-art\.generated'/);
});

test('release provenance is normalized to the repository MIT grant', () => {
  assert.equal(MANIFEST.author, 'Sergey Matyunin (Matysh)');
  assert.equal(MANIFEST.license, 'MIT');
  const readme = fs.readFileSync(
    path.join(ROOT, 'assets', 'furniture', 'houseplan-0.4.0', 'README.md'), 'utf8');
  // #593: документ провенанса переехал вместе с пакетом и НЕ ослаблен. Три
  // строки те же по смыслу, что и у 0.3.0: грант владельца, имя проверенного
  // архива и его SHA-256. Ровно они — единственная исполнимая защита от
  // повторения истории #159, где авторство подтвердили в рабочей сессии.
  assert.match(readme, /issuecomment-5739841899/);
  assert.match(readme, /houseplan-furniture-0\.4\.0\.zip/);
  assert.match(readme, /69BA5E0C398542D59F24269F637F57B8EBF31C2836C9D493F084AD29AB299FDE/);
  assert.match(readme, /60 top-view drawings/);
});

// #593 AC1: «ровно 60 плановых символов» — единственное, что отличает
// проверенную поставку от произвольной папки с SVG. Утверждение стоит ровно
// столько, сколько стоит его проверка: генератор запускается на поставке, у
// которой символов 59, и обязан отказать.
test('the generator refuses a pack whose cardinality drifted', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'houseplan-pack-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    for (const file of ['generate-furniture-assets.mjs', 'furniture-path-join.mjs', 'svg-path-bounds.mjs']) {
      cpSync(path.join(ROOT, 'scripts', file), path.join(dir, 'scripts', file));
    }
    fs.mkdirSync(path.join(dir, 'src'));
    const pack = path.join(dir, 'assets', 'furniture', 'houseplan-0.4.0');
    cpSync(path.join(ROOT, 'assets', 'furniture', 'houseplan-0.4.0'), pack, { recursive: true });

    // Контроль: нетронутая копия проходит. Без него отказ ниже мог бы быть
    // отказом окружения, а не отказом по числу символов.
    const clean = spawnSync(process.execPath, ['scripts/generate-furniture-assets.mjs'], { cwd: dir, encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    const manifest = JSON.parse(fs.readFileSync(path.join(pack, 'pack.json'), 'utf8'));
    const dropped = manifest.symbols.pop();
    fs.rmSync(path.join(pack, dropped.file));
    fs.writeFileSync(path.join(pack, 'pack.json'), JSON.stringify(manifest, null, 2));
    const drifted = spawnSync(process.execPath, ['scripts/generate-furniture-assets.mjs'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(drifted.status, 0, 'поставка из 59 символов обязана быть отвергнута');
    assert.match(`${drifted.stderr}${drifted.stdout}`, /exactly 60 plan symbols are required/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
