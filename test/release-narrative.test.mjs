import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { milestoneQuery } from '../scripts/release-ledger.mjs';
import { narrativeLanguages, validateNarrative } from '../scripts/release-narrative.mjs';
import { markdownToTelegram, telegramPayload, TELEGRAM_LIMIT } from '../scripts/telegram-release.mjs';
import { assertReleaseContract, changelogContainsVersion, changelogVersionBody, validateReleaseNotes } from '../scripts/release-contract.mjs';

const tag = 'v1.81.0', repo = 'x/y';
const cycle = { schema: 1, baseStable: 'v1.80.1', targetStable: tag, milestone: { number: 3, title: '1.81' } };
const catalogue = { cycle, entries: [{ issue: 1, category: 'major' }, { issue: 2, category: 'stable-fix' }, { issue: 3, category: 'line-fix' }, { issue: 4, category: 'infra' }] };
const issueLink = (n) => `[#${n}](https://github.com/${repo}/issues/${n})`;
const collection = `[Все изменения](${milestoneQuery(repo, cycle)})`;
const notes = (body) => `<!-- release: ${tag} -->\n<!-- stable-notes: 1 -->\n<!-- base: v1.80.1 -->\n<!-- language: ru -->\n${body}\n<!-- language: en -->\n${body}\n`;
const mixed = notes(`Теперь редактировать план удобнее.\n\n- Новая возможность. ${issueLink(1)}\n\nТакже устранены задержки существовавшего редактора.\n\n${collection}`);
const check = (text, cat = catalogue) => validateNarrative(text, { tag, repo, catalogue: cat });

test('real candidate contract checks selected root, exact changelog prose and announcement length BEFORE publishing', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hp-narrative-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@x', ...args], { encoding: 'utf8' });
  git('init', '-q');
  write('docs/release-ledger/cycle.json', JSON.stringify(cycle));
  git('add', '.'); git('commit', '-qm', 'base'); git('tag', cycle.baseStable);
  for (const row of catalogue.entries) write(`docs/release-ledger/v1.80.1/${row.issue}.json`, JSON.stringify({
    schema: 1, baseStable: cycle.baseStable, rationale: 'Evidence relative to previous stable',
    summary: { ru: 'Факт', en: 'Fact' }, ...(row.category === 'line-fix' ? { introducedBy: 1 } : {}), ...row,
  }));
  git('add', '.'); git('commit', '-qm', catalogue.entries.map((row) => `Issue: #${row.issue}`).join('\n'));
  const version = tag.slice(1);
  write('package.json', JSON.stringify({ version }));
  write('package-lock.json', JSON.stringify({ version, packages: { '': { version } } }));
  write('custom_components/houseplan/manifest.json', JSON.stringify({ version }));
  write('custom_components/houseplan/const.py', `VERSION = "${version}"`);
  write('src/houseplan-card.ts', `const CARD_VERSION = "${version}"`);
  write('src/houseplan-editor-runtime.ts', `const CARD_VERSION = "${version}"`);
  const changelog = (body) => `## ${tag} — 2026-10-09\n\n${body}\n`;
  const installNotes = (text) => {
    const { ru, en } = narrativeLanguages(text, { tag });
    write('docs/RELEASE-NOTES.md', text);
    write('docs/CHANGELOG.ru.md', changelog(ru));
    write('docs/CHANGELOG.md', changelog(en));
  };
  installNotes(mixed);
  git('add', '.'); git('commit', '-qm', `Release: ${tag}\nIssue: #1`);
  assert.equal(assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }).version, version);
  write('docs/CHANGELOG.ru.md', changelog('Разошедшийся текст.'));
  assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }), /exact authored/);
  installNotes(mixed.replaceAll('Теперь редактировать план удобнее.', 'я'.repeat(TELEGRAM_LIMIT)));
  assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }), /agent must shorten/);
});

test('authored mixed release is preserved with intro, major list, genuine polish and compact collection', () => {
  assert.equal(check(mixed), mixed);
  assert.equal(validateReleaseNotes(mixed, { tag, repo, catalogue }), mixed);
  assert.ok(narrativeLanguages(mixed, { tag }).ru.startsWith('Теперь'));
  const ru = narrativeLanguages(mixed, { tag }).ru;
  assert.equal(changelogVersionBody(`## ${tag} — 2026-10-09\n\n${ru}\n\n## v1.80.1 — 2026-10-08\nOld.`, tag), ru);
});

test('fixes-only stable has two paragraphs and no list; infrastructure-only does not invent fixes', () => {
  const fixes = { cycle, entries: catalogue.entries.filter((row) => row.category !== 'major') };
  const fixNotes = notes(`Обновление делает план надёжнее.\n\nИсправлены задержки при редактировании существовавших стен.\n\n${collection}`);
  assert.equal(check(fixNotes, fixes), fixNotes);
  assert.throws(() => check(fixNotes.replace('Исправлены задержки', '- Исправлены задержки'), fixes), /no list|end with/);
  const infra = { cycle, entries: [{ issue: 4, category: 'infra' }] };
  assert.doesNotThrow(() => check(notes(`Пользовательское поведение не изменилось.\n\n${collection}`), infra));
  assert.equal(changelogContainsVersion(`## ${tag} — 2026-10-09\n\nТолько исправления.`, tag, { allowParagraphs: true }), true);
  assert.equal(changelogContainsVersion(`## ${tag} — 2026-10-09\n\nТолько исправления.`, tag), false, 'prerelease list contract is unchanged');
});

test('stable refuses beta-only, infrastructure, foreign, raw and misplaced links', () => {
  for (const n of [2,3,4,999]) assert.throws(() => check(mixed.replaceAll(issueLink(1), issueLink(n))), /classified major/);
  assert.throws(() => check(mixed.replaceAll(`Новая возможность. ${issueLink(1)}`, `${issueLink(1)} Новая возможность.`)), /end with/);
  assert.throws(() => check(mixed.replace('Теперь', 'https://github.com/x/y Теперь')), /introductory/);
  assert.throws(() => check(mixed.replaceAll(collection, '[Все](https://github.com/x/y/milestone/3)')), /including closed/);
  assert.throws(() => check(mixed.replace('<!-- base: v1.80.1 -->', '<!-- base: v1.79.0 -->')), /previous stable/);
});

test('at most five flat major bullets, grouping allowed; each major needs evidence in both locales', () => {
  const majors = { cycle, entries: Array.from({ length: 6 }, (_, i) => ({ issue: i+1, category: 'major' })) };
  const six = notes(`Большое обновление плана.\n\n${majors.entries.map(({ issue }) => `- Изменение. ${issueLink(issue)}`).join('\n')}\n\n${collection}`);
  assert.throws(() => check(six, majors), /1–5/);
  const grouped = six.replaceAll(`- Изменение. ${issueLink(5)}\n- Изменение. ${issueLink(6)}`, `- Группа. ${issueLink(5)} ${issueLink(6)}`);
  assert.equal(check(grouped, majors), grouped);
  assert.throws(() => check(grouped.replace(issueLink(1), issueLink(2)), majors), /coverage/);
});

test('Telegram transports only RU prose with actual clickable issue anchors, escaped text and no expanded URL', () => {
  const source = mixed.replace('Теперь', 'Безопасно <b> & "текст": теперь');
  const payload = telegramPayload({ notes: source, tag, url: 'https://github.com/x/y/releases/tag/v1.81.0', chat: '@channel' });
  assert.equal(payload.parse_mode, 'HTML');
  assert.match(payload.text, /<a href="https:\/\/github.com\/x\/y\/issues\/1">#1<\/a>/);
  assert.match(payload.text, /&lt;b&gt; &amp; &quot;текст&quot;/);
  assert.equal(payload.text.split('Новая возможность.').length, 2, 'no English duplicate');
  assert.doesNotMatch(payload.text, /<!--|\[#1\]|Основное|Highlights/);
  assert.equal(payload.link_preview_options.is_disabled, true);
  assert.throws(() => markdownToTelegram('[bad](https://user:pass@github.com/x/y)'), /credential-free/);
  assert.throws(() => markdownToTelegram('[bad](https://example.com)'), /GitHub/);
});

test('Telegram enforces the whole parsed-text limit without byte clipping and test dispatch stays independent', () => {
  const long = notes(`${'я'.repeat(TELEGRAM_LIMIT)}\n\n${collection}`);
  assert.throws(() => telegramPayload({ notes: long, tag, url: 'https://github.com/x/y', chat: '42' }), /agent must shorten/);
  const escaped = markdownToTelegram('я & < > 🏠');
  assert.equal(escaped.plain, 'я & < > 🏠');
  assert.equal(telegramPayload({ chat: '42', testMessage: true }).parse_mode, 'HTML');
  assert.throws(() => telegramPayload({ notes: mixed, tag: `${tag}-beta.1`, chat: '42' }), /Only stable/);
});
