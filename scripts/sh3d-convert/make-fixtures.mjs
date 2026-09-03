#!/usr/bin/env node
/**
 * Синтетические фикстуры `.sh3d` (#446).
 *
 * Настоящих файлов Sweet Home 3D у сборки нет и быть не может: их негде взять
 * автоматически. Поэтому фикстуры собираются здесь по опубликованному формату
 * и коммитятся вместе с генератором — чтобы было видно, что именно проверяется,
 * и чтобы это можно было пересобрать. Проверка на реальном файле остаётся
 * ручной приёмкой владельца, и это записано в issue.
 *
 * Геометрия нарочно «как у людей»: комнаты Sweet Home 3D обводят по ВНУТРЕННИМ
 * граням стен, а не по осевым линиям, поэтому фикстура 1 проверяет главное
 * геометрическое решение конвертера — привязку вершин к осевым линиям и сварку
 * общей границы двух комнат.
 *
 *   node scripts/sh3d-convert/make-fixtures.mjs
 */
import { deflateRawSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'fixtures');

const crc = (bytes) => {
  if (typeof crc32 === 'function') return crc32(bytes) >>> 0;
  let table = crcTable();
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ table[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
};
const crcTable = () => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
};

/** Минимальный писатель zip: ровно то, что читает `zip.mjs`. */
function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.from(entry.data, 'utf8');
    const deflated = entry.store ? raw : deflateRawSync(raw);
    const method = entry.store ? 0 : 8;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // имена в utf-8
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc(raw), 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, deflated);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x800, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt32LE(crc(raw), 16);
    header.writeUInt32LE(deflated.length, 20);
    header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + deflated.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, eocd]);
}

const attrs = (record) => Object.entries(record)
  .filter(([, value]) => value !== undefined && value !== null)
  .map(([key, value]) => ` ${key}='${String(value).replace(/&/g, '&amp;').replace(/'/g, '&apos;').replace(/</g, '&lt;')}'`)
  .join('');

const room = (record, points) =>
  `  <room${attrs(record)}>\n${points.map(([x, y]) => `    <point x='${x}' y='${y}'/>`).join('\n')}\n  </room>`;
const wall = (record) => `  <wall${attrs(record)}/>`;
const doorOrWindow = (record) => `  <doorOrWindow${attrs(record)}/>`;
const level = (record) => `  <level${attrs(record)}/>`;

const home = (record, body) =>
  `<?xml version='1.0'?>\n<!DOCTYPE home SYSTEM 'http://www.sweethome3d.com/SweetHome3D.dtd'>\n`
  + `<home${attrs({ version: 7500, ...record })}>\n${body.join('\n')}\n</home>\n`;

/** 1. Квартира из двух комнат: контуры по внутренним граням, дверь и окно. */
const flat = home({ name: 'Flat', wallHeight: 250 }, [
  level({ id: 'level0', name: 'Первый этаж', elevation: 0, elevationIndex: 0, height: 250, floorThickness: 12 }),
  wall({ id: 'w-n', level: 'level0', xStart: 0, yStart: 0, xEnd: 600, yEnd: 0, thickness: 20, height: 250 }),
  wall({ id: 'w-e', level: 'level0', xStart: 600, yStart: 0, xEnd: 600, yEnd: 400, thickness: 20, height: 250 }),
  wall({ id: 'w-s', level: 'level0', xStart: 600, yStart: 400, xEnd: 0, yEnd: 400, thickness: 20, height: 250 }),
  wall({ id: 'w-w', level: 'level0', xStart: 0, yStart: 400, xEnd: 0, yEnd: 0, thickness: 20, height: 250 }),
  wall({ id: 'w-mid', level: 'level0', xStart: 300, yStart: 0, xEnd: 300, yEnd: 400, thickness: 10, height: 250 }),
  room({ id: 'room-kitchen', level: 'level0', name: 'Кухня', areaVisible: 'true' },
    [[10, 10], [295, 10], [295, 390], [10, 390]]),
  room({ id: 'room-bedroom', level: 'level0', name: 'Спальня', areaVisible: 'true' },
    [[305, 10], [590, 10], [590, 390], [305, 390]]),
  // Углы в файле НАМЕРЕННО не совпадают со стенами: дверь на вертикальной
  // стене объявлена под 0°, окно на горизонтальной — под 33°. Единицы и смысл
  // угла в `.sh3d` доверия не заслуживают, а серверная привязка допускает 8°.
  // Конвертер обязан брать угол у ребра — иначе оба проёма не получат хозяина.
  // Центры тоже НАМЕРЕННО сдвинуты с осевой линии: дверь на 2 см, окно на 1.5.
  // Так и бывает в жизни — проём тащат мышью вдоль грани стены. Серверная
  // привязка допускает 0.02 шага решётки (при клетке 5 см это ~0.2 мм),
  // поэтому центр обязан проецироваться на ребро, а не браться как есть.
  doorOrWindow({ id: 'door-mid', level: 'level0', catalogId: 'eTeks#doorFrame', name: 'Door',
    x: 302, y: 205, width: 90, depth: 10, height: 200, angle: 0 }),
  doorOrWindow({ id: 'window-north', level: 'level0', catalogId: 'eTeks#fixedWindow85x123',
    name: 'Window', x: 150, y: 1.5, width: 120, depth: 20, height: 120, angle: 33 }),
]);

/** 2. Два уровня по комнате — проверяет разделение на документы. */
const house = home({ name: 'House' }, [
  level({ id: 'ground', name: 'Ground', elevation: 0, elevationIndex: 0 }),
  level({ id: 'first', name: 'First', elevation: 280, elevationIndex: 1 }),
  wall({ id: 'g-n', level: 'ground', xStart: 0, yStart: 0, xEnd: 500, yEnd: 0, thickness: 30 }),
  wall({ id: 'g-e', level: 'ground', xStart: 500, yStart: 0, xEnd: 500, yEnd: 500, thickness: 30 }),
  wall({ id: 'g-s', level: 'ground', xStart: 500, yStart: 500, xEnd: 0, yEnd: 500, thickness: 30 }),
  wall({ id: 'g-w', level: 'ground', xStart: 0, yStart: 500, xEnd: 0, yEnd: 0, thickness: 30 }),
  room({ id: 'hall', level: 'ground', name: 'Hall' }, [[15, 15], [485, 15], [485, 485], [15, 485]]),
  wall({ id: 'f-n', level: 'first', xStart: 0, yStart: 0, xEnd: 500, yEnd: 0, thickness: 30 }),
  wall({ id: 'f-e', level: 'first', xStart: 500, yStart: 0, xEnd: 500, yEnd: 500, thickness: 30 }),
  wall({ id: 'f-s', level: 'first', xStart: 500, yStart: 500, xEnd: 0, yEnd: 500, thickness: 30 }),
  wall({ id: 'f-w', level: 'first', xStart: 0, yStart: 500, xEnd: 0, yEnd: 0, thickness: 30 }),
  room({ id: 'attic', level: 'first', name: 'Attic' }, [[15, 15], [485, 15], [485, 485], [15, 485]]),
]);

/** 3. Кривые случаи: дуга, стена 120 см, комната из двух точек, уровень без
 *  комнат, дверь в чистом поле. */
const awkward = home({ name: 'Awkward' }, [
  level({ id: 'main', name: 'Main', elevation: 0, elevationIndex: 0 }),
  level({ id: 'empty', name: 'Walls only', elevation: 300, elevationIndex: 1 }),
  wall({ id: 'a-n', level: 'main', xStart: 0, yStart: 0, xEnd: 400, yEnd: 0, thickness: 120 }),
  wall({ id: 'a-e', level: 'main', xStart: 400, yStart: 0, xEnd: 400, yEnd: 300, thickness: 20, arcExtent: 45 }),
  wall({ id: 'a-s', level: 'main', xStart: 400, yStart: 300, xEnd: 0, yEnd: 300, thickness: 20 }),
  wall({ id: 'a-w', level: 'main', xStart: 0, yStart: 300, xEnd: 0, yEnd: 0, thickness: 20 }),
  room({ id: 'ok-room', level: 'main', name: 'Комната' },
    [[60, 10], [390, 10], [390, 290], [60, 290]]),
  room({ id: 'thin', level: 'main', name: 'Полоска' }, [[10, 10], [20, 10]]),
  doorOrWindow({ id: 'lost-door', level: 'main', catalogId: 'eTeks#door', name: 'Door',
    x: 5000, y: 5000, width: 80 }),
  // Проём шире ребра: 9 метров на стене длиной 3.3. Хост допускает только
  // проём, целиком лежащий внутри сегмента, поэтому длина обрезается до ребра
  // — с записью в отчёт. Без обрезки проём просто не получил бы хозяина.
  doorOrWindow({ id: 'wide-door', level: 'main', catalogId: 'eTeks#door', name: 'Door',
    x: 225, y: 300, width: 900 }),
  wall({ id: 'e-n', level: 'empty', xStart: 0, yStart: 0, xEnd: 200, yEnd: 0, thickness: 10 }),
  wall({ id: 'e-e', level: 'empty', xStart: 200, yStart: 0, xEnd: 200, yEnd: 200, thickness: 10 }),
]);

/** 4. Общая граница без стены и с шумом: проверяет сварку вершин. */
const noisy = home({ name: 'Noisy' }, [
  level({ id: 'flat', name: 'Flat', elevation: 0, elevationIndex: 0 }),
  wall({ id: 'n-n', level: 'flat', xStart: 0, yStart: 0, xEnd: 800, yEnd: 0, thickness: 20 }),
  wall({ id: 'n-e', level: 'flat', xStart: 800, yStart: 0, xEnd: 800, yEnd: 300, thickness: 20 }),
  wall({ id: 'n-s', level: 'flat', xStart: 800, yStart: 300, xEnd: 0, yEnd: 300, thickness: 20 }),
  wall({ id: 'n-w', level: 'flat', xStart: 0, yStart: 300, xEnd: 0, yEnd: 0, thickness: 20 }),
  // Между зонами стены нет вовсе, а их общая граница набрана мышью: 400.4
  // против 399.7. Без сварки это две границы в полусантиметре друг от друга,
  // и сервер получит два сегмента с одним владельцем вместо одного с двумя.
  room({ id: 'zone-left', level: 'flat', name: 'Гостиная' },
    [[10, 10], [400.4, 10], [400.4, 290], [10, 290]]),
  room({ id: 'zone-right', level: 'flat', name: 'Столовая' },
    [[399.7, 10], [790, 10], [790, 290], [399.7, 290]]),
]);

mkdirSync(OUT, { recursive: true });
const files = [
  ['flat-two-rooms.sh3d', zip([{ name: 'Home.xml', data: flat }])],
  // Метод 0: читатель обязан уметь и несжатые записи.
  ['two-levels.sh3d', zip([{ name: 'Home.xml', data: house, store: true }])],
  ['noisy-shared-edge.sh3d', zip([{ name: 'Home.xml', data: noisy }])],
  ['awkward.sh3d', zip([
    { name: 'Home.xml', data: awkward },
    { name: 'ContentDigests', data: 'ignored\n' },
  ])],
];
for (const [name, bytes] of files) {
  writeFileSync(join(OUT, name), bytes);
  console.log(`${name}: ${bytes.length} Б`);
}
