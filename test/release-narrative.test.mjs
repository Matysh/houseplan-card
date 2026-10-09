import test from 'node:test';
import assert from 'node:assert/strict';
import { milestoneQuery } from '../scripts/release-ledger.mjs';
import { narrativeLanguages, validateNarrative, stableHeading } from '../scripts/release-narrative.mjs';
import { markdownToTelegram, telegramPayload, TELEGRAM_LIMIT } from '../scripts/telegram-release.mjs';
import { changelogContainsVersion, validateReleaseNotes } from '../scripts/release-contract.mjs';

const tag = 'v1.81.0', repo = 'x/y';
const cycle = { schema: 1, baseStable: 'v1.80.1', targetStable: tag, milestone: { number: 3, title: '1.81' } };
const catalogue = { cycle, entries: [{ issue: 1, category: 'major' }, { issue: 2, category: 'stable-fix' }, { issue: 3, category: 'line-fix' }, { issue: 4, category: 'infra' }] };
const issueLink = (n) => `[#${n}](https://github.com/${repo}/issues/${n})`;
const collection = `[Все изменения](${milestoneQuery(repo, cycle)})`;
const notes = (body) => `<!-- release: ${tag} -->\n<!-- stable-notes: 1 -->\n<!-- base: v1.80.1 -->\n<!-- language: ru -->\n${stableHeading(tag, 'ru')}\n\n${body}\n<!-- language: en -->\n${stableHeading(tag, 'en')}\n\n${body}\n`;
const mixed = notes(`Теперь редактировать план удобнее.\n\n🧱 **Новая возможность.** Двигайте стены. ${issueLink(1)}\n\nТакже устранены задержки существовавшего редактора.\n\n${collection}`);
const check = (text, cat = catalogue) => validateNarrative(text, { tag, repo, catalogue: cat });

test('authored mixed release is preserved with intro, major list, genuine polish and compact collection', () => {
  assert.equal(check(mixed), mixed);
  assert.equal(validateReleaseNotes(mixed, { tag, repo, catalogue }), mixed);
  assert.ok(narrativeLanguages(mixed, { tag }).ru.startsWith(stableHeading(tag, 'ru')));
});

test('fixes-only stable has two paragraphs and no list; infrastructure-only does not invent fixes', () => {
  const fixes = { cycle, entries: catalogue.entries.filter((row) => row.category !== 'major') };
  const fixNotes = notes(`Обновление делает план надёжнее.\n\nИсправлены задержки при редактировании существовавших стен.\n\n${collection}`);
  assert.equal(check(fixNotes, fixes), fixNotes);
  assert.throws(() => check(fixNotes.replace('Исправлены задержки', '- Исправлены задержки'), fixes), /bullet lists|no list|end with/);
  const infra = { cycle, entries: [{ issue: 4, category: 'infra' }] };
  assert.doesNotThrow(() => check(notes(`Пользовательское поведение не изменилось.\n\n${collection}`), infra));
  assert.equal(changelogContainsVersion(`## ${tag} — 2026-10-09\n\nТолько исправления.`, tag, { allowParagraphs: true }), true);
  assert.equal(changelogContainsVersion(`## ${tag} — 2026-10-09\n\nТолько исправления.`, tag), false, 'prerelease list contract is unchanged');
});

test('stable refuses beta-only, infrastructure, foreign, raw and misplaced links', () => {
  for (const n of [2,3,4,999]) assert.throws(() => check(mixed.replaceAll(issueLink(1), issueLink(n))), /classified major/);
  assert.throws(() => check(mixed.replaceAll(`Двигайте стены. ${issueLink(1)}`, `${issueLink(1)} Двигайте стены.`)), /end with/);
  assert.throws(() => check(mixed.replace('Теперь', 'https://github.com/x/y Теперь')), /introductory/);
  assert.throws(() => check(mixed.replaceAll(collection, '[Все](https://github.com/x/y/milestone/3)')), /including closed/);
  assert.throws(() => check(mixed.replace('<!-- base: v1.80.1 -->', '<!-- base: v1.79.0 -->')), /previous stable/);
});

test('at most five flat major bullets, grouping allowed; each major needs evidence in both locales', () => {
  const majors = { cycle, entries: Array.from({ length: 6 }, (_, i) => ({ issue: i+1, category: 'major' })) };
  const six = notes(`Большое обновление плана.\n\n${majors.entries.map(({ issue }) => `🧱 **Изменение.** Двигайте стены. ${issueLink(issue)}`).join('\n\n')}\n\n${collection}`);
  assert.throws(() => check(six, majors), /1–5/);
  const grouped = six.replaceAll(`🧱 **Изменение.** Двигайте стены. ${issueLink(5)}\n\n🧱 **Изменение.** Двигайте стены. ${issueLink(6)}`, `🧱 **Группа.** Двигайте стены. ${issueLink(5)} ${issueLink(6)}`);
  assert.equal(check(grouped, majors), grouped);
  assert.throws(() => check(grouped.replace(issueLink(1), issueLink(2)), majors), /coverage/);
});

test('stable format refuses ordinary bullets, missing emoji/bold, missing heading and tight feature spacing', () => {
  assert.throws(() => check(mixed.replace('## Новый релиз - HousePlan 1.81.0\n\n', '')), /release heading/);
  assert.throws(() => check(mixed.replaceAll('🧱 **Новая возможность.**', '- Новая возможность.')), /bullet lists/);
  assert.throws(() => check(mixed.replaceAll('🧱 **Новая возможность.**', 'Новая возможность.')), /1–5/);
  const cat = { cycle, entries: [{ issue: 1, category: 'major' }, { issue: 2, category: 'major' }] };
  const spaced = notes(`Изменения плана.\n\n🧱 **Первое.** Двигайте стены. ${issueLink(1)}\n\n🔋 **Второе.** Видно заряд. ${issueLink(2)}\n\n${collection}`);
  assert.doesNotThrow(() => check(spaced, cat));
  assert.throws(() => check(spaced.replaceAll('\n\n🔋', '\n🔋'), cat), /blank line/);
});

test('Telegram transports only RU prose with actual clickable issue anchors, escaped text and no expanded URL', () => {
  const source = mixed.replace('Теперь', 'Безопасно <b> & "текст": теперь');
  const payload = telegramPayload({ notes: source, tag, url: 'https://github.com/x/y/releases/tag/v1.81.0', chat: '@channel' });
  assert.equal(payload.parse_mode, 'HTML');
  assert.match(payload.text, /<a href="https:\/\/github.com\/x\/y\/issues\/1">#1<\/a>/);
  assert.match(payload.text, /&lt;b&gt; &amp; &quot;текст&quot;/);
  assert.equal(payload.text.split('Новая возможность.').length, 2, 'no English duplicate');
  assert.match(payload.text, /^<b>Новый релиз - HousePlan 1\.81\.0<\/b>\n\n/);
  assert.match(payload.text, /\n\n🧱 <b>Новая возможность\.<\/b>/);
  assert.doesNotMatch(payload.text, /houseplan-card v|\[Релиз\]|\*\*|^##/);
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
