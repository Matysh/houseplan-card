/**
 * #266: one-shot mechanical splitter. Reads src/styles.ts, cuts the css``
 * template into top-level blocks (rule, @media, @keyframes — with their
 * leading comments), classifies every block by the owner of its first
 * selector token, and writes five surface files plus the aggregator.
 * A token missing from the table aborts the run: no silent "misc" bucket.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ZONES = { base: [], plan: [], devices: [], chrome: [], dialogs: [] };
const T = {};
const assign = (zone, tokens) => { for (const t of tokens.split(/\s+/)) T[t] = zone; };

assign('base', ':host .sr-only ha-card .bootveil .toast .empty .spacer');
assign('plan', `.stage .plan-svg .hp-paper .hp-static-stage .hp-day-cycle-bg .hp-day-cycle-sun .hp-day-cycle-env
  .seg .vertex .pathline .preview .active-axis .active-vertex .physical-hit .physical-chrome .physical-drag
  .drawwall .drawwall-preview .drawwall-preview-fill .openwall .openwall-preview .wall-repair-preview
  .wallbody .wallbody-fill .wallthick-hover .griddot .boundary-point
  .plan-snap-node .plan-snap-line .plan-snap-overlay .hidden-wall-line .hidden-wall-node .hidden-wall-diagnostic
  .room .room-outline .room-hover-fill .room-hover-halo .room-hover-outline .roomlabel
  .rlhandle .rlgear .rlgearbtn .rlname .rlgo
  .measurelabel .measurelayer .compass .homearrow .zoomwrap .zoomctl .zoombadge
  .decorlayer .glow-spot .glow-pools .glow-pools-frame .glow-base-layer .glow-base-tunnels .sunlayer
  .iso-opening-panel .iso-ambient-shadow .iso-contact-shadow .iso-leaf-shadow .iso-wall-side .iso-wall-top
  .iso-floor-side .iso-side-hi .iso-side-lo .iso-top-hi .iso-top-lo .iso-shadows-svg .iso-underlay-svg
  .iso-walls-svg .iso-underlay .iso-shadows .iso-walls .iso-openings
  .opening-preview .opening-preview-dot .opening-dimension .opening-dimensions .opening-dimension-line
  .opening-dimension-tick .op-leaf .op-arc .op-hit .op-outline .passage-preview-boundary .passage-preview-cut
  .aligndot .alignline .alignmsg .rszhandle .rszicon .rszleader .rszhalo .rszink .rszmeasurehalo
  .rszmeasureink .rszmeasurelayer .bdframe .dtframe .dtarea .devlayer .fixedfloor-loading .fixedfloor-error
  line .projection-toggle`);
assign('devices', `.dev .device-pulse .device-shell .device-shell-frame .device-core .device-sections
  .devicepreview-empty .activity-dot .vactrail .vacpuck .temprange .kdot .kioskdots`);
assign('chrome', `.editbar .editbar-end .editbar-tools .tab .tabs .modetab .modes .decorbar
  .editorchrome .editorchrome-inner .menu .menuwrap .dropbtn .droppanel .hdr .farhint .rhint .tip .togglehint`);
assign('dialogs', `hp-dialog .btn .oplock .oplock-core .oplock-shell .rrow .colorrow .ripple-colorrow
  .ripple-sizerow .optimize-details .optimize-live .optimize-cleanup .optimize-selected .recoveryoverlay
  .savedplan .savedplans .savedmeta .backupdetails .backupactions .backupfile .backupcontent .backupplanonly
  .backupplanonlystatus .backupupload .backupchoices .backupconfirm .backuperror .backupsummary .backupwarn
  .backupcounts .backupbody .pdf .pdfedit .pdflist .pdftag .planprev .planrow .planname .cardpreview
  .namein .descin .areasel .entrow .entlist .entbtn .cand .candlist .srcrow .gsrow .inforow .infodesc
  .dispsection .floorrow .fileupload .filebtn .furnsize .furnhd .furnitem .furnbody .furngroup .furnhint
  .furnpalette .furnprev .furnrow .wallthick-dlg .vacpicker .vacsource .vacsource-list .vacsource-meta
  .vacsource-warning .vacdiag .vacfit .vacfitdot .vacfithandle .vacfitknob .vacbox .vaccalbar .vacxcme
  .sunrow .suncol .aboutlink .aboutver .count .head .title .markerhelplabel .markerhelpfield .markerradios
  .markeractions .markersaveactions .markerlightgroup .markerlightdisabled .markerglowvalue
  .markerbadgetechnical .opening-entity-candidate .opening-entity-empty .habindingbanner .bindsel
  .bindharow .curbind .ctrlchip .ctrlchips .ctrlopt .ctrlstate .ctrlstates .ctrllist .oprow .iconauto
  .rtest .rtesticon ha-icon-picker`);

const argValue = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
};
const sourcePath = argValue('source', 'src/styles.ts');
// Cumulative slice list in the FINAL aggregator order suffix (#266 §1.4):
// e.g. --take chrome,dialogs keeps base+plan+devices inline and appends the
// two extracted files after the inline remainder.
const TAKE = (argValue('take', 'base,plan,devices,chrome,dialogs') || '')
  .split(',').map((z) => z.trim()).filter(Boolean);
const FINAL_ORDER = ['base', 'plan', 'devices', 'chrome', 'dialogs'];
for (const zone of TAKE) if (!FINAL_ORDER.includes(zone)) throw new Error(`unknown zone ${zone}`);
const source = readFileSync(sourcePath, 'utf8');
const m = source.match(/css`([\s\S]*)`;\s*$/);
if (!m) throw new Error('styles.ts: css template not found');
const cssBody = m[1];

// Cut into top-level blocks with leading comments/blank lines attached.
const blocks = [];
let i = 0;
let pending = '';
while (i < cssBody.length) {
  const rest = cssBody.slice(i);
  const cm = rest.match(/^\s*\/\*[\s\S]*?\*\//);
  if (cm && !rest.slice(0, rest.indexOf('/*')).includes('{')) {
    // comment before any brace: attach to the next block
    pending += cm[0];
    i += cm[0].length;
    continue;
  }
  const open = cssBody.indexOf('{', i);
  if (open === -1) { pending += cssBody.slice(i); break; }
  const header = cssBody.slice(i, open);
  let depth = 1, j = open + 1;
  while (j < cssBody.length && depth > 0) {
    if (cssBody[j] === '{') depth++;
    else if (cssBody[j] === '}') depth--;
    j++;
  }
  blocks.push({ text: pending + header + cssBody.slice(open, j), header: header.trim() });
  pending = '';
  i = j;
}

const zoneOfSelector = (header) => {
  const first = (sel) => {
    const t = sel.trim().match(/^[.:#\[]?[\w-]+/);
    return t ? t[0] : null;
  };
  const zones = new Set();
  for (const sel of header.split(',')) {
    const token = first(sel);
    if (!token) continue;
    const zone = T[token];
    if (!zone) throw new Error(`unclassified token «${token}» in «${header.slice(0, 80)}»`);
    zones.add(zone);
  }
  if (!zones.size) throw new Error(`no tokens in «${header.slice(0, 80)}»`);
  return zones.size === 1 ? [...zones][0] : 'base';
};

const innerHeader = (header) => header.replace(/^@(media|supports)[^{]*$/s, '').trim();
for (const block of blocks) {
  let zone;
  if (/^@keyframes/.test(block.header)) {
    // keyframes are owned by their consumers; classify by name prefix
    const name = block.header.replace(/^@keyframes\s+/, '');
    zone = /^(hp-dev|dev|pulse|vac)/.test(name) ? 'devices'
      : /^(hp-spin|spin|fade|toast)/.test(name) ? 'base' : 'base';
  } else if (/^@(media|supports)/.test(block.header)) {
    // classify by the first inner selector
    const inner = block.text.slice(block.text.indexOf('{') + 1);
    const sel = inner.slice(0, inner.indexOf('{')).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    zone = zoneOfSelector(sel);
  } else {
    zone = zoneOfSelector(block.header);
  }
  ZONES[zone].push(block.text);
  block.zone = zone;
}

mkdirSync('src/styles', { recursive: true });
const taken = FINAL_ORDER.filter((zone) => TAKE.includes(zone));
const kept = FINAL_ORDER.filter((zone) => !TAKE.includes(zone));
const NAMES = { base: 'base', plan: 'plan', devices: 'devices', chrome: 'chrome', dialogs: 'dialogs' };
const DOC = {
  base: 'Host, variables, resets and cross-surface rules',
  plan: 'The plan scene: stage, walls, axes, snap, decor, iso and resize ink',
  devices: 'Device markers, shells, pulses and vacuum presentation',
  chrome: 'Editor chrome: toolbars, tabs, menus and hints',
  dialogs: 'Dialogs, forms, buttons and pickers',
};
const tidy = (chunk) => chunk.replace(/^\n+/, '').replace(/\n+$/, '');
for (const zone of taken) {
  const body = ZONES[zone].map(tidy).join('\n');
  writeFileSync(`src/styles/${NAMES[zone]}.styles.ts`,
    `/** ${DOC[zone]} (#266, split from styles.ts). */\nimport { css } from 'lit';\n\nexport const ${zone}Styles = css\`\n${body}\n\`;\n`);
  console.log(zone, ZONES[zone].length, 'blocks ->', `src/styles/${NAMES[zone]}.styles.ts`);
}
if (kept.length) {
  // Intermediate slice: the not-yet-extracted zones stay inline IN SOURCE
  // ORDER, extracted zones append after them in the final-order suffix, so
  // every relative position matches the final aggregator and golden can gate
  // each slice.
  const keptBlocks = blocks.filter((block) => !taken.includes(block.zone));
  const imports = taken.map((zone) =>
    `import { ${zone}Styles } from './styles/${NAMES[zone]}.styles';`).join('\n');
  writeFileSync('src/styles.ts', `/** Styles of the House Plan card — being split by surface (#266). */
import { css } from 'lit';
import type { CSSResultGroup } from 'lit';
${imports}

export { ${taken.map((zone) => `${zone}Styles`).join(', ')} };

const inlineStyles = css\`
${keptBlocks.map((block) => tidy(block.text)).join('\n')}
\`;

export const cardStyles: CSSResultGroup = [
  inlineStyles, ${taken.map((zone) => `${zone}Styles`).join(', ')},
];
`);
  console.log('aggregator with inline remainder written:', kept.join('+'), 'inline;', taken.join(', '), 'extracted');
} else writeFileSync('src/styles.ts', `/**
 * Styles of the House Plan card — assembled from the surface files (#266).
 *
 * The ORDER of this array is part of the cascade contract: rules of equal
 * specificity resolve by position, and the golden set was accepted against
 * exactly this order. Do not reorder without re-reviewing the golden set.
 */
import type { CSSResultGroup } from 'lit';
import { baseStyles } from './styles/base.styles';
import { planStyles } from './styles/plan.styles';
import { devicesStyles } from './styles/devices.styles';
import { chromeStyles } from './styles/chrome.styles';
import { dialogsStyles } from './styles/dialogs.styles';

export { baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles };

export const cardStyles: CSSResultGroup = [
  baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles,
];
`);
console.log('aggregator written');
