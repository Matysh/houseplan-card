#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualFingerprint } from './source-fingerprint.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXTERNAL = process.argv.includes('--external');
const PUBLIC_DOCS = [
  'README.md', 'README.ru.md', 'docs/USER-GUIDE.md', 'docs/USER-GUIDE.ru.md',
  'docs/TOUCH-SUPPORT.md', 'docs/DECOR-EDITOR.md', 'docs/VACUUM.md',
];
const EXPECTED_SCREENSHOTS = [
  'view-desktop', 'view-touch', 'space-create', 'room-contour-close',
  'plan-context-tray', 'device-editor', 'device-display-preview', 'background-editor',
  'room-card', 'device-info',
];
const errors = [];
const warnings = [];
const externalUrls = new Set();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalText = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');

const withoutFences = (text) => text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
const slug = (heading) => heading
  .trim().toLowerCase()
  .replace(/<[^>]+>/g, '')
  .replace(/[^\p{L}\p{N}\s_-]/gu, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const headingsFor = (path) => {
  const seen = new Map();
  const headings = new Set();
  for (const line of canonicalText(path).split('\n')) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = slug(match[1]);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    headings.add(count ? `${base}-${count}` : base);
  }
  return headings;
};

const rootPrefix = `${ROOT}${sep}`.toLowerCase();
for (const relative of PUBLIC_DOCS) {
  const path = resolve(ROOT, relative);
  if (!existsSync(path)) {
    errors.push(`${relative}: required public document is missing`);
    continue;
  }
  const text = withoutFences(canonicalText(path));
  const links = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
  for (const match of text.matchAll(links)) {
    const image = match[1] === '!';
    const alt = match[2].trim();
    const raw = match[3].trim().replace(/\s+"[^"]*"$/, '');
    if (image && !alt) errors.push(`${relative}: image has empty alt text (${raw})`);
    if (/^(?:https?:)?\/\//i.test(raw)) {
      try {
        const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
        if (url.protocol !== 'https:') errors.push(`${relative}: external link must use https (${raw})`);
        externalUrls.add(url.href);
      } catch {
        errors.push(`${relative}: invalid external URL (${raw})`);
      }
      continue;
    }
    if (/^(?:mailto:|#|\/api\/|\/houseplan_files\/)/.test(raw)) {
      if (raw.startsWith('#')) {
        const anchor = decodeURIComponent(raw.slice(1));
        if (anchor && !headingsFor(path).has(anchor))
          errors.push(`${relative}: missing local heading #${anchor}`);
      }
      continue;
    }
    const hashAt = raw.indexOf('#');
    const filePart = decodeURIComponent(hashAt >= 0 ? raw.slice(0, hashAt) : raw);
    const anchor = hashAt >= 0 ? decodeURIComponent(raw.slice(hashAt + 1)) : '';
    const target = resolve(dirname(path), filePart || '.');
    const targetLower = target.toLowerCase();
    if (targetLower !== ROOT.toLowerCase() && !targetLower.startsWith(rootPrefix)) {
      errors.push(`${relative}: link escapes repository (${raw})`);
      continue;
    }
    if (!existsSync(target)) {
      errors.push(`${relative}: missing relative target (${raw})`);
      continue;
    }
    if (image && !statSync(target).isFile()) errors.push(`${relative}: image target is not a file (${raw})`);
    if (anchor && extname(target).toLowerCase() === '.md' && !headingsFor(target).has(anchor))
      errors.push(`${relative}: missing heading ${filePart}#${anchor}`);
  }
}

const sectionMarkers = (relative) => [...canonicalText(resolve(ROOT, relative))
  .matchAll(/<!--\s*docs-section:\s*([a-z0-9-]+)\s*-->/g)].map((match) => match[1]);
for (const [en, ru, required] of [
  ['README.md', 'README.ru.md', ['overview', 'features', 'first-run', 'installation', 'support']],
  ['docs/USER-GUIDE.md', 'docs/USER-GUIDE.ru.md', ['model', 'installation', 'first-run', 'modes', 'input', 'spaces', 'plan-tools', 'devices', 'visual-states', 'background', 'multiple-cards', 'limits', 'diagnostics']],
]) {
  const enMarkers = sectionMarkers(en);
  const ruMarkers = sectionMarkers(ru);
  if (JSON.stringify(enMarkers) !== JSON.stringify(ruMarkers))
    errors.push(`${en} / ${ru}: docs-section markers differ or are ordered differently`);
  for (const marker of required) {
    if (!enMarkers.includes(marker)) errors.push(`${en} / ${ru}: missing required section marker ${marker}`);
  }
}

const staleTerms = [
  [/\bMarkup (?:tab|mode|editor)\b/gi, 'Plan'],
  [/(?:вкладка|режим|редактор) «Разметка»/gi, '«План»'],
  [/\bDecor editor\b/gi, 'Background editor'],
];
for (const relative of PUBLIC_DOCS.slice(0, 4)) {
  const text = withoutFences(canonicalText(resolve(ROOT, relative)));
  for (const [pattern, replacement] of staleTerms) {
    const matches = text.match(pattern) || [];
    if (matches.length) errors.push(`${relative}: stale term “${matches[0]}”; use ${replacement}`);
  }
}

const manifestPath = resolve(ROOT, 'docs/images/screenshots.json');
if (!existsSync(manifestPath)) {
  errors.push('docs/images/screenshots.json: missing screenshot index');
} else {
  const manifest = JSON.parse(canonicalText(manifestPath));
  if (manifest.fixture !== 'synthetic-only') errors.push('screenshot manifest must declare synthetic-only fixture');
  // Версионно-нечувствительный отпечаток (#245): бамп версии не меняет ни одного
  // пикселя, поэтому не обязан требовать пересъёмки — иначе каждый релизный
  // коммит оставляет этот гейт красным.
  if (manifest.sourceFingerprint !== visualFingerprint(ROOT))
    errors.push('screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs');
  const scriptPath = resolve(ROOT, 'demo/docs/capture.mjs');
  if (manifest.captureScriptSha256 !== sha256(readFileSync(scriptPath)))
    errors.push('screenshot capture script changed; run npm run build && node demo/docs/capture.mjs');
  const ids = Object.keys(manifest.scenarios || {});
  if (JSON.stringify(ids.sort()) !== JSON.stringify([...EXPECTED_SCREENSHOTS].sort()))
    errors.push('screenshot manifest scenario set is incomplete');
  for (const [id, scenario] of Object.entries(manifest.scenarios || {})) {
    const imagePath = resolve(ROOT, 'docs/images', scenario.file || '');
    if (!existsSync(imagePath)) errors.push(`screenshot ${id}: missing ${scenario.file}`);
    else if (scenario.imageSha256 !== sha256(readFileSync(imagePath)))
      errors.push(`screenshot ${id}: image hash does not match manifest`);
    if (scenario.sourceSha256 !== manifest.sourceFingerprint)
      errors.push(`screenshot ${id}: source SHA does not match manifest`);
    if (!scenario.viewport?.width || !scenario.viewport?.height || !scenario.theme || !scenario.language)
      errors.push(`screenshot ${id}: capture metadata is incomplete`);
  }
}

if (EXTERNAL) {
  const allowlist = JSON.parse(canonicalText(resolve(ROOT, 'docs/external-link-allowlist.json')));
  const transientHosts = new Set(allowlist.transientHosts || []);
  for (const href of [...externalUrls].sort()) {
    const url = new URL(href);
    try {
      const response = await fetch(url, {
        method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000),
        headers: { 'user-agent': 'houseplan-docs-check/1' },
      });
      if (response.status >= 200 && response.status < 400) continue;
      if ([403, 408, 425, 429].includes(response.status) || response.status >= 500) {
        if (transientHosts.has(url.hostname)) {
          warnings.push(`transient external response ${response.status}: ${href}`);
          continue;
        }
      }
      errors.push(`external link returned ${response.status}: ${href}`);
    } catch (error) {
      if (transientHosts.has(url.hostname)) warnings.push(`transient external failure: ${href} (${error.message})`);
      else errors.push(`external link failed: ${href} (${error.message})`);
    }
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation checks passed (${PUBLIC_DOCS.length} files, ${externalUrls.size} external links).`);
}
