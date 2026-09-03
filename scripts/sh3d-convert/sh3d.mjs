/**
 * Чтение `.sh3d` (Sweet Home 3D) в плоскую модель в сантиметрах (#446).
 *
 * Формат: zip, внутри `Home.xml` — тот, что описан их публичной DTD. Читаются
 * ровно четыре сущности: уровни, комнаты (полигоны), стены (осевая линия +
 * толщина), двери и окна. Всё остальное — мебель, материалы, текстуры, свет,
 * камеры, размерные линии, фон уровня — сознательно не читается: см. SCOPE,
 * «мы живая пространственная карта, а не редактор интерьера».
 *
 * Единицы Sweet Home 3D — сантиметры, ось Y вниз, как у нас.
 */
import { parseXml, childrenOf } from './xml.mjs';
import { readZipEntry } from './zip.mjs';

export class Sh3dError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const num = (raw, fallback = NaN) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(String(raw).trim());
  return Number.isFinite(value) ? value : fallback;
};

/** Дверь или окно: формат их не различает, различаем по каталогу и имени. */
const WINDOW_HINTS = [
  'window', 'fenetre', 'fenêtre', 'fenster', 'ventana', 'finestra', 'raam',
  'окно', 'окн',
];
export function openingKind(piece) {
  const haystack = `${piece.catalogId || ''} ${piece.name || ''}`.toLowerCase();
  return WINDOW_HINTS.some((hint) => haystack.includes(hint)) ? 'window' : 'door';
}

/** Разобрать уже распакованный `Home.xml`. */
export function parseHomeXml(xml) {
  const home = parseXml(xml);
  if (home.tag !== 'home') {
    throw new Sh3dError('not_home', 'Home.xml не начинается с элемента <home>');
  }
  const levels = childrenOf(home, 'level').map((node, index) => ({
    id: String(node.attrs.id ?? `level${index}`),
    name: String(node.attrs.name ?? '').trim(),
    elevation: num(node.attrs.elevation, 0),
    elevationIndex: num(node.attrs.elevationIndex, index),
  }));
  const rooms = childrenOf(home, 'room').map((node, index) => ({
    id: String(node.attrs.id ?? `room${index}`),
    level: node.attrs.level === undefined ? null : String(node.attrs.level),
    name: String(node.attrs.name ?? '').trim(),
    points: childrenOf(node, 'point')
      .map((point) => [num(point.attrs.x), num(point.attrs.y)])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])),
  }));
  const walls = childrenOf(home, 'wall').map((node, index) => ({
    id: String(node.attrs.id ?? `wall${index}`),
    level: node.attrs.level === undefined ? null : String(node.attrs.level),
    a: [num(node.attrs.xStart), num(node.attrs.yStart)],
    b: [num(node.attrs.xEnd), num(node.attrs.yEnd)],
    thickness: num(node.attrs.thickness, NaN),
    arcExtent: num(node.attrs.arcExtent, 0),
  })).filter((wall) => wall.a.every(Number.isFinite) && wall.b.every(Number.isFinite));
  const openings = childrenOf(home, 'doorOrWindow').map((node, index) => {
    const piece = {
      id: String(node.attrs.id ?? `piece${index}`),
      level: node.attrs.level === undefined ? null : String(node.attrs.level),
      name: String(node.attrs.name ?? '').trim(),
      catalogId: String(node.attrs.catalogId ?? ''),
      x: num(node.attrs.x),
      y: num(node.attrs.y),
      width: num(node.attrs.width, NaN),
      angle: num(node.attrs.angle, 0),
    };
    return { ...piece, kind: openingKind(piece) };
  }).filter((piece) => Number.isFinite(piece.x) && Number.isFinite(piece.y));
  const unit = String(home.attrs.unit ?? '').trim().toLowerCase();
  return {
    name: String(home.attrs.name ?? '').trim(),
    version: String(home.attrs.version ?? ''),
    unit,
    levels,
    rooms,
    walls,
    openings,
  };
}

/** Прочитать байты `.sh3d` целиком. */
export async function readSh3d(bytes) {
  const xml = await readZipEntry(bytes, 'Home.xml');
  return parseHomeXml(new TextDecoder('utf-8').decode(xml));
}
