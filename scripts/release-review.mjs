#!/usr/bin/env node
/**
 * Вход независимого ревью линии перед стабильным релизом (#638, PROCESS.md §11.5).
 *
 *   node scripts/release-review.mjs prepare --tag=v1.78.0 --candidate=<sha> --out=<dir>
 *   node scripts/release-review.mjs doc --tag=v1.78.0
 *
 * Ревью «с нуля» судит поверхности, изменённые всей линией бет, а не дифф
 * одной задачи. Поэтому база — прошлый СТАБИЛЬНЫЙ тег, достижимый из
 * кандидата (беты этой линии внутри диапазона), а список issue доказывается
 * трейлерами `Issue: #NN` тем же построителем и в той же схеме, что
 * `RELEASE-MEMBERSHIP.json` беты (#547): метка S8 — не доказательство.
 *
 * `prepare` пишет в `--out` два файла — `line-membership.json` (манифест линии)
 * и `brief.md` (вход промпта) — и печатает `key=value` для `$GITHUB_OUTPUT`.
 * Ни ТЗ, ни документов раундов в брифе нет намеренно: ревью независимое.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { buildReleaseMembership, issueTrailers, validateReleaseMembership } from './release-membership.mjs';
import { classify } from './process-gate.mjs';

export const RELEASE_REVIEW_DIR = 'docs/reviews';
export const STABLE_TAG_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA_RE = /^[0-9a-f]{40,64}$/;

/** Путь документа ревью для стабильного тега; бета и мусор — отказ. */
export function releaseReviewDocPath(tag) {
  if (!STABLE_TAG_RE.test(String(tag))) throw new Error(`not a stable release tag: ${tag}`);
  return `${RELEASE_REVIEW_DIR}/RELEASE-REVIEW-${tag}.md`;
}

const parts = (tag) => STABLE_TAG_RE.exec(tag).slice(1, 4).map(Number);
const compare = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/**
 * Прошлый стабильный тег среди `reachable` (тегов, достижимых из кандидата):
 * наибольший стабильный строго ниже `tag`. Беты и сам тег не годятся — иначе
 * диапазон сжался бы до последней беты и ревью линии стало бы ревью хвоста.
 */
export function previousStableTag(reachable, tag) {
  releaseReviewDocPath(tag);
  const older = reachable.filter((name) => STABLE_TAG_RE.test(name) && compare(name, tag) < 0);
  older.sort(compare);
  return older.at(-1) ?? null;
}

/** Продуктовые файлы (класс A) из диффа линии — поверхности для ревью. */
export function productFiles(files) {
  return [...new Set(files.map((file) => file.replaceAll('\\', '/')))]
    .filter((file) => classify(file) === 'A')
    .sort();
}

/** Манифест линии: все issue, чьи трейлеры есть в диапазоне base..candidate. */
export function buildLineMembership({ tag, candidate, base, commits }) {
  releaseReviewDocPath(tag);
  const issueNumbers = [...new Set(commits.flatMap((commit) => issueTrailers(commit.message)))];
  const { manifest } = buildReleaseMembership({ tag, candidate, base, commits, issueNumbers });
  return validateReleaseMembership(manifest, { tag, candidate });
}

export function renderBrief({ membership, files, runUrl = '' }) {
  const product = productFiles(files);
  const lines = [
    `# Вход независимого ревью ${membership.tag}`,
    '',
    `- Кандидат: \`${membership.candidate}\``,
    `- База линии (прошлый стабильный): ${membership.base ? `\`${membership.base.tag}\` · \`${membership.base.sha}\`` : 'нет — первая стабильная версия, судится всё дерево'}`,
    ...(runUrl ? [`- Прогон: ${runUrl}`] : []),
    `- Документ: \`${releaseReviewDocPath(membership.tag)}\``,
    '',
    `## Issue линии (${membership.issues.length}) — доказаны трейлерами \`Issue: #NN\``,
    '',
    ...(membership.issues.length
      ? membership.issues.map((row) => `- #${row.number} · коммитов: ${row.commits.length}`)
      : ['- (нет)']),
    '',
    `## Изменённые продуктовые файлы (класс A, ${product.length}) — из них выводятся поверхности`,
    '',
    ...(product.length ? product.map((file) => `- \`${file}\``) : ['- (нет)']),
    '',
    `Всего файлов в диффе линии: ${files.length}.`,
    '',
  ];
  return lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n');
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return r.stdout.trim();
}

/** Кандидат, база и история линии из git (без сети). */
export function readLine(tag, candidate) {
  if (!SHA_RE.test(String(candidate))) throw new Error(`invalid candidate SHA: ${candidate}`);
  const reachable = git(['tag', '--merged', candidate]).split('\n').map((s) => s.trim()).filter(Boolean);
  const baseTag = previousStableTag(reachable, tag);
  const base = baseTag ? { tag: baseTag, sha: git(['rev-list', '-n', '1', baseTag]) } : null;
  const range = base ? `${base.sha}..${candidate}` : candidate;
  const raw = git(['log', '--format=%H%x1f%B%x1e', range]);
  const commits = raw.split('\x1e').map((r) => r.trim()).filter(Boolean).map((record) => {
    const at = record.indexOf('\x1f');
    return { sha: record.slice(0, at).trim(), message: record.slice(at + 1) };
  });
  const files = base
    ? git(['diff', '--name-only', base.sha, candidate]).split('\n').filter(Boolean)
    : git(['ls-tree', '-r', '--name-only', candidate]).split('\n').filter(Boolean);
  return { base, commits, files };
}

if (isMainModule(import.meta.url)) {
  try {
    const [command, ...rest] = process.argv.slice(2);
    const value = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
    const tag = value('tag');
    if (command === 'doc') {
      console.log(releaseReviewDocPath(tag));
    } else if (command === 'prepare') {
      const candidate = value('candidate');
      const out = resolve(value('out') || '.');
      const { base, commits, files } = readLine(tag, candidate);
      const membership = buildLineMembership({ tag, candidate, base, commits });
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'line-membership.json'), `${JSON.stringify(membership, null, 2)}\n`);
      writeFileSync(join(out, 'brief.md'), renderBrief({ membership, files, runUrl: value('run-url') }));
      console.log(`doc=${releaseReviewDocPath(tag)}`);
      console.log(`base=${base ? base.tag : ''}`);
      console.log(`issues=${membership.issues.map((row) => row.number).join(',')}`);
    } else {
      throw new Error('usage: release-review.mjs prepare --tag=vX.Y.Z --candidate=<sha> --out=<dir> | doc --tag=vX.Y.Z');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
