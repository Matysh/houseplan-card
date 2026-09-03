/**
 * Минимальный читатель zip для `.sh3d` (#446).
 *
 * `.sh3d` — это zip, внутри которого нужен ровно один вход: `Home.xml`.
 * Библиотеки не берём (см. `xml.mjs`), поэтому здесь читается центральный
 * каталог и распаковывается одна запись: метод 0 (без сжатия) и метод 8
 * (deflate). Распаковка берётся из окружения: в браузере
 * `DecompressionStream('deflate-raw')`, в Node — `node:zlib`.
 *
 * Границы недоверенного ввода жёсткие и все на входе: шифрованные записи,
 * zip64, слишком большая распакованная запись и подозрительные имена
 * отвергаются кодом ошибки, а не исключением из недр.
 */

export class ZipError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

const u16 = (view, at) => view.getUint16(at, true);
const u32 = (view, at) => view.getUint32(at, true);

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const zlib = await import('node:zlib');
  return new Uint8Array(zlib.inflateRawSync(bytes));
}

/** Смещение EOCD: ищем подпись с конца, учитывая возможный комментарий. */
function findEndOfCentralDirectory(view) {
  const limit = Math.min(view.byteLength, 0xffff + 22);
  for (let back = 22; back <= limit; back++) {
    const at = view.byteLength - back;
    if (at < 0) break;
    if (u32(view, at) === EOCD) return at;
  }
  throw new ZipError('not_zip', 'Это не zip-архив: не найден конец центрального каталога');
}

/**
 * Список записей архива: имя, метод, смещение, размеры.
 * Данные не читаются — только каталог, чтобы решение «брать или отказать»
 * принималось до распаковки.
 */
export function listZipEntries(source) {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const count = u16(view, eocd + 10);
  let at = u32(view, eocd + 16);
  if (at === 0xffffffff || count === 0xffff) {
    throw new ZipError('zip64', 'zip64 не поддерживается');
  }
  const entries = [];
  for (let index = 0; index < count; index++) {
    if (at + 46 > bytes.byteLength || u32(view, at) !== CENTRAL) {
      throw new ZipError('bad_central', 'Повреждён центральный каталог');
    }
    const flags = u16(view, at + 8);
    const nameLength = u16(view, at + 28);
    const extraLength = u16(view, at + 30);
    const commentLength = u16(view, at + 32);
    const name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'utf-8')
      .decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.push({
      name,
      encrypted: (flags & 0x1) !== 0,
      method: u16(view, at + 10),
      compressedSize: u32(view, at + 20),
      uncompressedSize: u32(view, at + 24),
      localOffset: u32(view, at + 42),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Распаковать одну запись по имени. */
export async function readZipEntry(source, name, maxBytes = MAX_ENTRY_BYTES) {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const entry = listZipEntries(bytes).find((item) => item.name === name);
  if (!entry) throw new ZipError('entry_missing', `В архиве нет ${name}`);
  if (entry.encrypted) throw new ZipError('encrypted', 'Архив защищён паролем');
  if (entry.uncompressedSize > maxBytes) {
    throw new ZipError('entry_too_large',
      `${name}: ${entry.uncompressedSize} Б распакованных — больше предела ${maxBytes} Б`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const local = entry.localOffset;
  if (local + 30 > bytes.byteLength || u32(view, local) !== LOCAL) {
    throw new ZipError('bad_local', 'Повреждён локальный заголовок записи');
  }
  const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
  const raw = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) {
    if (raw.byteLength > maxBytes) throw new ZipError('entry_too_large', 'Запись больше предела');
    return raw.slice();
  }
  if (entry.method !== 8) {
    throw new ZipError('unsupported_method', `Метод сжатия ${entry.method} не поддерживается`);
  }
  const out = await inflateRaw(raw);
  // Объявленный размер не авторитетен: бомба объявляет мало, отдаёт много.
  if (out.byteLength > maxBytes) {
    throw new ZipError('entry_too_large', `${name}: распаковано больше предела ${maxBytes} Б`);
  }
  return out;
}
