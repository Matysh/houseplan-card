/**
 * The smallest ZIP reader and writer the backup journeys need, on Node's own
 * zlib: read what House Plan exports, write the archives the import journeys
 * feed it. Deflate or stored entries, no ZIP64, no encryption, no comments —
 * exactly the closed container the integration accepts (backup_archive.py).
 */
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** `{ name: Buffer }` in archive order. Throws on anything it cannot read. */
export function readZip(buffer) {
  const raw = Buffer.from(buffer);
  let end = -1;
  for (let i = raw.length - 22; i >= Math.max(0, raw.length - 65557); i--) {
    if (raw.readUInt32LE(i) === EOCD) { end = i; break; }
  }
  if (end < 0) throw new Error('not a ZIP: no end of central directory');
  const count = raw.readUInt16LE(end + 10);
  let at = raw.readUInt32LE(end + 16);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (raw.readUInt32LE(at) !== CENTRAL) throw new Error('broken central directory');
    const method = raw.readUInt16LE(at + 10);
    const packedSize = raw.readUInt32LE(at + 20);
    const size = raw.readUInt32LE(at + 24);
    const nameLength = raw.readUInt16LE(at + 28);
    const extraLength = raw.readUInt16LE(at + 30);
    const commentLength = raw.readUInt16LE(at + 32);
    const local = raw.readUInt32LE(at + 42);
    const name = raw.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    if (raw.readUInt32LE(local) !== LOCAL) throw new Error(`broken local header: ${name}`);
    const start = local + 30 + raw.readUInt16LE(local + 26) + raw.readUInt16LE(local + 28);
    const compressed = raw.subarray(start, start + packedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
    if (!data) throw new Error(`unsupported method ${method}: ${name}`);
    if (data.length !== size) throw new Error(`size mismatch: ${name}`);
    entries[name] = data;
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** A deflated ZIP of `[name, Buffer]` pairs in the given order (fixed timestamps: same bytes every time). */
export function writeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content);
    const packed = deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // time 00:00
    local.writeUInt16LE(0x21, 12); // date 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE(0x0314, 4); // made by: unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(((0o100600) << 16) >>> 0, 38); // regular file, 0600
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
