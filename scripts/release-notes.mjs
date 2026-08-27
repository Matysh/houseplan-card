#!/usr/bin/env node
/**
 * Release notes for STABLE releases (#328).
 *
 * Owner rules (2026-08-27):
 * 1. A stable release aggregates the changelog since the PREVIOUS STABLE
 *    release, not since the last beta: every feature/fix described in the
 *    line's beta changelogs must reach the stable body.
 * 2. A bug that was introduced AND fixed inside the beta line (never present
 *    in any stable release) must not appear in the stable body. That judgment
 *    needs a human: the draft lists every candidate item with its source
 *    section so the curator can strike the in-line-only fixes.
 * 3. «Мелкие исправления и улучшения» / «Small fixes and improvements» is
 *    allowed ONLY when such work really exists — user-visible commits in the
 *    range whose issues the body does not mention explicitly. A single-issue
 *    hotfix ships without the filler line.
 *
 * Usage:
 *   node scripts/release-notes.mjs v1.69.0            # print an aggregation draft
 *   node scripts/release-notes.mjs v1.69.0 --verify   # verify docs/RELEASE-NOTES.md
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const SMALL_FIXES_RU = 'Мелкие исправления и улучшения';
const SMALL_FIXES_EN = 'Small fixes and improvements';

export function parseVersion(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(tag).trim());
  if (!match) return null;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  };
}

export function compareVersions(a, b) {
  const va = parseVersion(a), vb = parseVersion(b);
  if (!va || !vb) throw new Error(`unparsable version: ${a} / ${b}`);
  for (let index = 0; index < 3; index++) {
    if (va.numbers[index] !== vb.numbers[index]) return va.numbers[index] - vb.numbers[index];
  }
  if (!va.prerelease && !vb.prerelease) return 0;
  if (!va.prerelease) return 1;   // release > its prereleases
  if (!vb.prerelease) return -1;
  return va.prerelease.localeCompare(vb.prerelease, 'en', { numeric: true });
}

export const isStable = (tag) => {
  const version = parseVersion(tag);
  return !!version && version.prerelease === null;
};

/** The latest stable tag strictly below `target`. */
export function previousStableTag(target, tags) {
  const below = tags.filter((tag) => isStable(tag) && parseVersion(tag)
    && compareVersions(tag, target) < 0);
  if (!below.length) return null;
  return below.sort(compareVersions).at(-1);
}

/** Split a CHANGELOG file into ordered sections: {version|null, title, items}. */
export function parseChangelog(text) {
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      const title = heading[1].trim();
      const versionMatch = /^(v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(title);
      current = {
        title,
        version: versionMatch ? versionMatch[1] : null,
        unreleased: /^(Unreleased|Не выпущено)/i.test(title),
        items: [],
      };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    if (/^- /.test(line)) current.items.push(line);
    else if (/^\s+\S/.test(line) && current.items.length) {
      current.items[current.items.length - 1] += `\n${line}`;
    }
  }
  return sections;
}

export const issuesOf = (text) => [...String(text)
  .matchAll(/(?:issues|pull)\/(\d+)|#(\d+)/g)]
  .map((match) => Number(match[1] ?? match[2]))
  .filter(Boolean);

/** Sections newer than prevStable and not newer than target (or unreleased). */
export function sectionsInRange(sections, prevStable, target) {
  return sections.filter((section) => {
    if (section.unreleased) return true;
    if (!section.version) return false;
    if (prevStable && compareVersions(section.version, prevStable) <= 0) return false;
    return compareVersions(section.version, target) <= 0;
  });
}

/** Aggregate items across the range; the newest wording per issue set wins.
 *  Sections come newest-first in the changelog, so first occurrence wins. */
export function aggregateItems(sections) {
  const seen = new Set();
  const out = [];
  for (const section of sections) {
    for (const item of section.items) {
      const key = issuesOf(item).sort((a, b) => a - b).join(',') || item.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ item, source: section.title });
    }
  }
  return out;
}

/** Issues from `Issue: #N` trailers of user-visible commits in a git range. */
export function visibleIssuesInRange(range, gitRunner = defaultGit) {
  const log = gitRunner(['log', '--format=%B%x1e', range]);
  const issues = new Set();
  for (const message of log.split('\x1e')) {
    if (!/^User-Visible:\s*yes\s*$/im.test(message)) continue;
    for (const match of message.matchAll(/^Issue:\s*#(\d+)\s*$/gim)) issues.add(Number(match[1]));
  }
  return issues;
}

const defaultGit = (args) => execFileSync('git', ['-C', ROOT, ...args], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});

export function verifyReleaseNotes({
  tag, notes, changelogRu, changelogEn, tags, gitRunner = defaultGit,
}) {
  const errors = [];
  const warnings = [];
  if (!isStable(tag)) errors.push(`тег ${tag} не стабильный — правила #328 применяются к стабильным релизам`);
  if (!notes.includes(`<!-- release: ${tag} -->`))
    errors.push(`docs/RELEASE-NOTES.md не помечен «<!-- release: ${tag} -->»`);

  const prevStable = previousStableTag(tag, tags);
  // Verify against the TAG when it already exists; against HEAD before
  // publication (the candidate is the branch tip).
  const endRef = tags.includes(tag) ? tag : 'HEAD';
  const range = prevStable ? `${prevStable}..${endRef}` : endRef;
  const visible = visibleIssuesInRange(range, gitRunner);

  const ruSections = sectionsInRange(parseChangelog(changelogRu), prevStable, tag);
  const enSections = sectionsInRange(parseChangelog(changelogEn), prevStable, tag);
  const changelogIssues = new Set();
  for (const section of [...ruSections, ...enSections]) {
    for (const item of section.items) for (const issue of issuesOf(item)) changelogIssues.add(issue);
  }

  const mentioned = new Set(issuesOf(notes));
  for (const issue of mentioned) {
    if (!visible.has(issue) && !changelogIssues.has(issue)) {
      errors.push(`#${issue} упомянут в теле, но не встречается ни в user-visible коммитах `
        + `диапазона ${range}, ни в ченджлоге линейки — тело шире релиза`);
    }
  }

  const unmentioned = [...visible].filter((issue) => !mentioned.has(issue));
  const hasFillerRu = notes.includes(SMALL_FIXES_RU);
  const hasFillerEn = notes.includes(SMALL_FIXES_EN);
  if ((hasFillerRu || hasFillerEn) && mentioned.size === 0 && visible.size > 0) {
    errors.push('пункты тела не ссылаются на issues (#NN) — законность приписки о мелких '
      + 'улучшениях непроверяема; добавь ссылки в пункты (правило #328)');
  }
  if ((hasFillerRu || hasFillerEn) && unmentioned.length === 0) {
    errors.push('приписка «мелкие исправления и улучшения» присутствует, но каждый '
      + `user-visible issue диапазона ${range} уже упомянут в теле — приписка пустая, убрать`);
  }
  if (!hasFillerRu && !hasFillerEn && unmentioned.length > 0) {
    warnings.push(`в диапазоне ${range} есть user-visible работы, не упомянутые в теле `
      + `(#${unmentioned.join(', #')}) — либо допиши пункты, либо верни приписку`);
  }
  if (hasFillerRu !== hasFillerEn) {
    errors.push('приписка о мелких улучшениях есть только в одном языке');
  }
  return { errors, warnings, prevStable, range, unmentioned };
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const tag = args.find((argument) => !argument.startsWith('--'));
  const verify = args.includes('--verify');
  if (!tag) {
    console.error('usage: node scripts/release-notes.mjs <stable-tag> [--verify]');
    process.exit(2);
  }
  const changelogRu = readFileSync(resolve(ROOT, 'docs/CHANGELOG.ru.md'), 'utf8');
  const changelogEn = readFileSync(resolve(ROOT, 'docs/CHANGELOG.md'), 'utf8');
  const tags = defaultGit(['tag', '--list', 'v*']).split('\n').filter((line) => parseVersion(line));

  if (verify) {
    const notes = readFileSync(resolve(ROOT, 'docs/RELEASE-NOTES.md'), 'utf8');
    const report = verifyReleaseNotes({ tag, notes, changelogRu, changelogEn, tags });
    for (const warning of report.warnings) console.warn(`ПРЕДУПРЕЖДЕНИЕ: ${warning}`);
    if (report.errors.length) {
      for (const error of report.errors) console.error(`ОШИБКА: ${error}`);
      process.exit(1);
    }
    console.log(`Тело релиза ${tag} проходит правила #328 `
      + `(диапазон ${report.range}, скрытых user-visible issue: ${report.unmentioned.length})`);
    process.exit(0);
  }

  const prevStable = previousStableTag(tag, tags);
  console.log(`# Черновик тела ${tag} — агрегат от предыдущего стабильного ${prevStable ?? '(нет)'}\n`);
  console.log('# Правь руками: вычеркни багфиксы, чей баг жил ТОЛЬКО внутри бета-линейки');
  console.log('# (не встречался ни в одном стабильном релизе) — им в стабильном теле не место.\n');
  for (const [label, changelog] of [['RU', changelogRu], ['EN', changelogEn]]) {
    console.log(`## Кандидаты (${label})\n`);
    const sections = sectionsInRange(parseChangelog(changelog), prevStable, tag);
    for (const { item, source } of aggregateItems(sections)) {
      console.log(`${item}\n    ^ из секции: ${source}\n`);
    }
  }
  const visible = visibleIssuesInRange(prevStable ? `${prevStable}..HEAD` : 'HEAD');
  console.log(`# User-visible issues диапазона: ${[...visible].sort((a, b) => a - b)
    .map((issue) => `#${issue}`).join(', ') || '(нет)'}`);
  console.log('# Приписка о мелких улучшениях законна только если часть из них не попала в тело.');
}
