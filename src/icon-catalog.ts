/** Catalogs expose the same names and inline SVG paths to the House Plan picker. */
export interface IconCatalog extends Pick<ReadonlyMap<string, string>, 'size' | 'keys' | 'get' | 'has'> {
  loadGlyphs?(names: readonly string[]): Promise<boolean>;
}

type CatalogLoader = () => Promise<IconCatalog>;
const standaloneCatalogs = new WeakMap<Document, CatalogLoader>();

export function registerStandaloneIconCatalog(document: Document, load: CatalogLoader): void {
  standaloneCatalogs.set(document, load);
}

const HA_MDI_ROOT = '/static/mdi/';
const ICON_NAME = /^[a-z0-9-]+$/;
const CHUNK_FILE = /^[a-f0-9]{40,64}$/;
interface Chunk { start?: string; file: string }

async function readAsset(file: string, mutable = false): Promise<unknown> {
  const response = await fetch(HA_MDI_ROOT + file, mutable ? { cache: 'no-cache' } : undefined);
  if (!response.ok) throw Error('Home Assistant MDI asset unavailable: ' + file);
  return response.json();
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function iconNames(list: unknown): string[] {
  if (!Array.isArray(list) || !list.length) throw Error('Invalid Home Assistant MDI list');
  return list.map(icon => {
    if (!record(icon) || typeof icon.name !== 'string' || !ICON_NAME.test(icon.name)) {
      throw Error('Invalid Home Assistant MDI name');
    }
    return 'mdi:' + icon.name;
  }).sort();
}

function chunkIndex(metadata: unknown): Chunk[] {
  if (!record(metadata) || !Array.isArray(metadata.parts) || !metadata.parts.length) {
    throw Error('Invalid Home Assistant MDI metadata');
  }
  let previous = '';
  return metadata.parts.map((part, index) => {
    if (!record(part) || typeof part.file !== 'string' || !CHUNK_FILE.test(part.file)
      || (index === 0 ? part.start !== undefined : typeof part.start !== 'string' || part.start <= previous)) {
      throw Error('Invalid Home Assistant MDI chunk');
    }
    const start = typeof part.start === 'string' ? part.start : undefined;
    previous = start ?? '';
    return { start, file: part.file };
  });
}

async function loadHaIconCatalog(): Promise<IconCatalog> {
  const [list, metadata] = await Promise.all([
    readAsset('iconList.json', true), readAsset('iconMetadata.json', true),
  ]);
  const names = new Set(iconNames(list));
  const chunks = chunkIndex(metadata);
  const paths = new Map<string, string>();
  const loads = new Map<string, Promise<void>>();
  const ready = new Set<string>();

  function glyphChunk(name: string): string {
    // Match HA's ordered part boundaries, including names equal to a boundary.
    const bare = name.slice('mdi:'.length);
    let file = chunks[0].file;
    for (const chunk of chunks) {
      if (chunk.start !== undefined && bare < chunk.start) break;
      file = chunk.file;
    }
    return file;
  }

  function loadChunk(file: string): Promise<void> {
    const current = loads.get(file);
    if (current) return current;
    const load = readAsset(file + '.json').then(payload => {
      if (!record(payload) || !Object.keys(payload).length
        || Object.values(payload).some(path => typeof path !== 'string')) {
        throw Error('Invalid Home Assistant MDI glyphs');
      }
      for (const [name, path] of Object.entries(payload)) {
        if (typeof path === 'string') paths.set('mdi:' + name, path);
      }
      ready.add(file);
    }).finally(() => loads.delete(file));
    loads.set(file, load);
    return load;
  }

  return {
    size: names.size,
    keys: () => names.keys(),
    has: name => names.has(name),
    get: name => paths.get(name),
    async loadGlyphs(icons) {
      const files = new Set(icons.filter(name => names.has(name)).map(glyphChunk));
      const pending = [...files].filter(file => !ready.has(file));
      await Promise.all(pending.map(loadChunk));
      return pending.length > 0;
    },
  };
}

let haCatalog: Promise<IconCatalog> | undefined;
export function iconCatalogFor(document: Document): Promise<IconCatalog> {
  const standalone = standaloneCatalogs.get(document);
  if (standalone) return standalone();
  return haCatalog ??= loadHaIconCatalog().catch(error => {
    haCatalog = undefined;
    throw error;
  });
}
