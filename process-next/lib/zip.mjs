import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const inspectZip = (zipPath, requiredNames) => {
  const archive = readFileSync(zipPath);
  if (!archive.length) throw new Error('houseplan.zip is empty');
  const required = new Set(requiredNames);
  const found = new Map();
  const names = [];
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minimumEocd = 22;
  const searchStart = Math.max(0, archive.length - minimumEocd - 0xffff);
  let eocd = -1;
  for (let offset = archive.length - minimumEocd; offset >= searchStart; offset--) {
    if (archive.readUInt32LE(offset) === eocdSignature
      && offset + minimumEocd + archive.readUInt16LE(offset + 20) === archive.length) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('houseplan.zip has no end-of-central-directory record');
  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const entryCount = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount)
    throw new Error('houseplan.zip must be a single-disk archive');
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff)
    throw new Error('houseplan.zip unexpectedly requires ZIP64');
  if (centralOffset + centralSize > eocd || centralOffset > archive.length)
    throw new Error('houseplan.zip central directory is outside the archive');

  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== centralSignature)
      throw new Error('houseplan.zip has a malformed central directory');
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > archive.length) throw new Error('houseplan.zip has a truncated central entry');
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength)
      .toString('utf8').replace(/^\.\//, '');
    names.push(name);
    cursor = next;
    if (!required.has(name)) continue;
    if (found.has(name)) throw new Error(`houseplan.zip contains duplicate ${name}`);
    if ((flags & 0x1) !== 0) throw new Error(`houseplan.zip entry ${name} is encrypted`);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff
      || localOffset === 0xffffffff) throw new Error(`houseplan.zip entry ${name} requires ZIP64`);
    if (uncompressedSize > 50 * 1024 * 1024)
      throw new Error(`houseplan.zip entry ${name} is unexpectedly large`);
    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== localSignature)
      throw new Error(`houseplan.zip entry ${name} has no valid local header`);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.length) throw new Error(`houseplan.zip entry ${name} is truncated`);
    const compressed = archive.subarray(dataStart, dataEnd);
    let contents;
    if (method === 0) contents = Buffer.from(compressed);
    else if (method === 8) contents = inflateRawSync(compressed, { maxOutputLength: 50 * 1024 * 1024 });
    else throw new Error(`houseplan.zip entry ${name} uses unsupported compression method ${method}`);
    if (contents.length !== uncompressedSize)
      throw new Error(`houseplan.zip entry ${name} has an invalid uncompressed size`);
    found.set(name, contents);
  }
  if (cursor !== centralOffset + centralSize)
    throw new Error('houseplan.zip central directory size is inconsistent');
  const missing = [...required].filter((name) => !found.has(name));
  if (missing.length) throw new Error(`houseplan.zip is missing ${missing.join(', ')}`);
  return { found, names };
};

export function readZipEntries(zipPath, requiredNames) {
  return inspectZip(zipPath, requiredNames).found;
}

export function listZipEntries(zipPath) {
  return inspectZip(zipPath, []).names;
}

