import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'assets', 'furniture', 'houseplan-0.3.0');
// Deliberately not named *manifest.json: HACS rejects a repository that
// contains any second file matching that suffix outside the integration.
const MANIFEST = path.join(PACK, 'pack.json');
// #474: каталог (id, группа, категория, размеры) — в стартовом графе, арт
// (SVG-пути, ~10 КБ gzip) — отдельный модуль, который View грузит лениво.
const CATALOG_OUT = path.join(ROOT, 'src', 'furniture-plan-catalog.generated.ts');
const PLAN_OUT = path.join(ROOT, 'src', 'furniture-plan-art.generated.ts');
const MENU_OUT = path.join(ROOT, 'src', 'furniture-menu-art.generated.ts');
const CHECK = process.argv.includes('--check');

const fail = (message) => { throw new Error(`Furniture pack: ${message}`); };
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plainObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
};
const exactKeys = (value, required, optional, label) => {
  plainObject(value, label);
  for (const key of required) if (!own(value, key)) fail(`${label}.${key} is required`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${label}.${key} is not allowed`);
};
const id = (value, label) => {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]*$/.test(value)) fail(`${label} is not a stable id`);
  return value;
};
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be non-empty text`);
  return value;
};
const positive = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) fail(`${label} must be positive`);
  return value;
};
const relSvg = (value, prefix, label) => {
  text(value, label);
  if (!new RegExp(`^svg/${prefix}/[a-z][a-z0-9_]*\\.svg$`).test(value)) fail(`${label} has an unsafe path`);
  return value;
};

function parseAttrs(source, label) {
  const attrs = Object.create(null);
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let scrubbed = source;
  for (const match of source.matchAll(re)) {
    if (own(attrs, match[1])) fail(`${label} repeats ${match[1]}`);
    attrs[match[1]] = match[2];
    scrubbed = scrubbed.replace(match[0], '');
  }
  if (scrubbed.trim()) fail(`${label} contains malformed attributes`);
  return attrs;
}

function svgArt(file, expectedViewBox) {
  const label = path.relative(ROOT, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
  if (/<!DOCTYPE|<!ENTITY|<\?|<!--|<script|<style/i.test(source)) fail(`${label} contains active XML`);
  const tags = [...source.matchAll(/<\/?([A-Za-z][\w:-]*)([^>]*)>/g)];
  if (!tags.length || tags[0][1] !== 'svg' || !source.endsWith('</svg>')) fail(`${label} is not one SVG root`);
  for (const tag of tags) if (!['svg', 'g', 'path'].includes(tag[1])) fail(`${label} contains <${tag[1]}>`);

  const root = source.match(/^<svg\s+([^>]*)>/);
  if (!root) fail(`${label} has no SVG root attributes`);
  const svgAttrs = parseAttrs(root[1], `${label} <svg>`);
  const svgKeys = Object.keys(svgAttrs).sort().join(',');
  if (svgKeys !== 'viewBox,xmlns' || svgAttrs.xmlns !== 'http://www.w3.org/2000/svg') fail(`${label} has unsupported SVG attributes`);
  const view = svgAttrs.viewBox.trim().split(/\s+/).map(Number);
  if (view.length !== 4 || view.some((n) => !Number.isFinite(n)) || view[0] !== 0 || view[1] !== 0 || view[2] <= 0 || view[3] <= 0) {
    fail(`${label} has an invalid viewBox`);
  }
  if (expectedViewBox && (view[2] !== expectedViewBox[0] || view[3] !== expectedViewBox[1])) {
    fail(`${label} viewBox does not match manifest dimensions`);
  }

  for (const match of source.matchAll(/<g([^>]*)>/g)) {
    if (match[1].trim()) fail(`${label} <g> attributes are not allowed`);
  }
  const paths = [];
  for (const match of source.matchAll(/<path\s+([^>]*)\/?\s*>/g)) {
    const attrs = parseAttrs(match[1].replace(/\/$/, ''), `${label} <path>`);
    const allowed = new Set(['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']);
    for (const key of Object.keys(attrs)) if (!allowed.has(key) || key.startsWith('on')) fail(`${label} path attribute ${key} is not allowed`);
    if (attrs.fill !== 'none' || attrs.stroke !== 'currentColor') fail(`${label} paths must use fill=none and stroke=currentColor`);
    if (!/^\d+(?:\.\d+)?$/.test(attrs['stroke-width'] || '')) fail(`${label} has an invalid stroke width`);
    if (attrs['stroke-linecap'] !== 'round' || attrs['stroke-linejoin'] !== 'round') fail(`${label} paths must use rounded joins`);
    const d = text(attrs.d, `${label} path.d`).trim().replace(/\s+/g, ' ');
    if (!/^[0-9eE+.,\-\sMmZzLlHhVvCcSsQqTtAa]+$/.test(d)) fail(`${label} path.d contains unsupported data`);
    paths.push(d);
  }
  if (!paths.length) fail(`${label} has no paths`);
  return { d: paths.join(' '), viewW: view[2], viewH: view[3] };
}

function loadPack() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  exactKeys(manifest,
    ['schema_version', 'view_schema', 'pack_id', 'pack_version', 'title_ru', 'title_en', 'author', 'license', 'source_url', 'menu_icons', 'symbols'],
    [], 'manifest');
  if (manifest.schema_version !== 1 || manifest.view_schema !== 2 || manifest.pack_id !== 'houseplan' || manifest.pack_version !== '0.3.0') fail('unsupported manifest identity');
  if (manifest.author !== 'Sergey Matyunin (Matysh)' || manifest.license !== 'MIT') fail('release provenance is incomplete');
  text(manifest.title_ru, 'manifest.title_ru'); text(manifest.title_en, 'manifest.title_en'); text(manifest.source_url, 'manifest.source_url');
  if (!Array.isArray(manifest.menu_icons) || manifest.menu_icons.length !== 33) fail('exactly 33 menu icons are required');
  if (!Array.isArray(manifest.symbols) || manifest.symbols.length !== 44) fail('exactly 44 plan symbols are required');

  const menuIds = new Set();
  const menu = manifest.menu_icons.map((entry, index) => {
    exactKeys(entry, ['id', 'name_ru', 'name_en', 'group', 'file'], [], `menu_icons[${index}]`);
    const entryId = id(entry.id, `menu_icons[${index}].id`);
    if (menuIds.has(entryId)) fail(`duplicate menu icon ${entryId}`); menuIds.add(entryId);
    if (!['furniture', 'appliance', 'sanitary', 'other'].includes(entry.group)) fail(`menu icon ${entryId} has an invalid group`);
    relSvg(entry.file, 'menu', `menu icon ${entryId}.file`);
    const base = path.basename(entry.file, '.svg');
    if (base !== entryId) fail(`menu icon ${entryId} filename must match its id`);
    return { id: entryId, group: entry.group, nameEn: text(entry.name_en, `${entryId}.name_en`), nameRu: text(entry.name_ru, `${entryId}.name_ru`), art: svgArt(path.join(PACK, entry.file)) };
  });

  const symbolIds = new Set();
  const symbols = manifest.symbols.map((entry, index) => {
    exactKeys(entry, ['id', 'operation', 'name_ru', 'name_en', 'group', 'width_cm', 'depth_cm', 'back', 'file', 'menu_icon', 'notes'], [], `symbols[${index}]`);
    const entryId = id(entry.id, `symbols[${index}].id`);
    if (symbolIds.has(entryId)) fail(`duplicate plan symbol ${entryId}`); symbolIds.add(entryId);
    if (!['replace', 'add'].includes(entry.operation)) fail(`symbol ${entryId} has an invalid operation`);
    if (!['furniture', 'appliance', 'sanitary', 'other'].includes(entry.group)) fail(`symbol ${entryId} has an invalid group`);
    if (entry.back !== 'top') fail(`symbol ${entryId} must keep BACK at the top`);
    const width = positive(entry.width_cm, `${entryId}.width_cm`);
    const depth = positive(entry.depth_cm, `${entryId}.depth_cm`);
    relSvg(entry.file, 'plan', `symbol ${entryId}.file`);
    if (path.basename(entry.file, '.svg') !== entryId) fail(`symbol ${entryId} filename must match its id`);
    if (!menuIds.has(entry.menu_icon)) fail(`symbol ${entryId} refers to unknown menu icon ${entry.menu_icon}`);
    const menuGroup = menu.find((item) => item.id === entry.menu_icon)?.group;
    if (menuGroup !== entry.group) fail(`symbol ${entryId} and its menu icon disagree on group`);
    return { id: entryId, operation: entry.operation, group: entry.group, category: entry.menu_icon,
      w: width, h: depth, nameEn: text(entry.name_en, `${entryId}.name_en`), nameRu: text(entry.name_ru, `${entryId}.name_ru`),
      art: svgArt(path.join(PACK, entry.file), [width, depth]) };
  });

  for (const folder of ['menu', 'plan']) {
    const declared = new Set((folder === 'menu' ? manifest.menu_icons : manifest.symbols).map((entry) => path.basename(entry.file)));
    const actual = fs.readdirSync(path.join(PACK, 'svg', folder)).filter((file) => file.endsWith('.svg'));
    if (actual.length !== declared.size || actual.some((file) => !declared.has(file))) fail(`svg/${folder} contains undeclared SVG files`);
  }
  return { menu, symbols };
}

const header = `/* Generated by scripts/generate-furniture-assets.mjs. DO NOT EDIT. */\n`;
function renderCatalog(symbols) {
  const runtime = symbols.map(({ id, group, category, w, h }) => ({ id, group, category, w, h }));
  return header + `export const GENERATED_FURNITURE_CATALOG = ${JSON.stringify(runtime)} as const;\n`;
}
function renderPlan(symbols) {
  const runtime = Object.fromEntries(symbols.map(({ id, art }) => [id, art]));
  return header
    + '// Lazy chunk (#474): imported dynamically by furniture-art-runtime.ts and\n'
    + '// statically by the editor. The fingerprint token is replaced at build time\n'
    + '// so a chunk from another build is rejected instead of half-applied.\n'
    + `export const FURNITURE_ART_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';\n`
    + `export const GENERATED_FURNITURE_ART: Readonly<Record<string, { d: string; viewW: number; viewH: number }>> = ${JSON.stringify(runtime)};\n`;
}
function renderMenu(menu) {
  const runtime = menu.map(({ id, group, art }) => ({ id, group, art }));
  return header + `export const GENERATED_FURNITURE_MENU = ${JSON.stringify(runtime)} as const;\n`;
}
function output(file, content) {
  const normalized = content.replaceAll('\\/', '/');
  if (CHECK) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== normalized) fail(`${path.relative(ROOT, file)} is stale; run npm run furniture:generate`);
  } else {
    fs.writeFileSync(file, normalized, 'utf8');
  }
}

const pack = loadPack();
output(CATALOG_OUT, renderCatalog(pack.symbols));
output(PLAN_OUT, renderPlan(pack.symbols));
output(MENU_OUT, renderMenu(pack.menu));
console.log(`Furniture pack OK: ${pack.symbols.length} plan symbols, ${pack.menu.length} menu icons${CHECK ? ' (generated files current)' : ''}.`);
