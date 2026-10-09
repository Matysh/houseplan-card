import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { userStableSection, composeUserStableNotes, USER_STABLE_PATHS } from '../scripts/user-stable-changelog.mjs';
import { narrativeLanguages, validateNarrative } from '../scripts/release-narrative.mjs';
import { telegramPayload, markdownToTelegram } from '../scripts/telegram-release.mjs';

const tag = 'v1.80.1', baseStable = 'v1.79.0';
const ru = readFileSync(new URL(`../${USER_STABLE_PATHS.ru}`, import.meta.url), 'utf8');
const en = readFileSync(new URL(`../${USER_STABLE_PATHS.en}`, import.meta.url), 'utf8');
const compose = (overrides = {}) => composeUserStableNotes({ changelogRu: ru, changelogEn: en, tag, baseStable, ...overrides });

test('approved 1.80.1 example is preserved as separate RU/EN user prose, not a technical changelog', () => {
  const languages = narrativeLanguages(compose(), { tag });
  assert.equal(languages.ru, userStableSection(ru, { tag, language: 'ru', baseStable }).body);
  assert.equal(languages.en, userStableSection(en, { tag, language: 'en', baseStable }).body);
  assert.match(languages.ru, /^## Релиз Houseplan 1\.80\.1\n\nРедактировать план стало удобнее:/);
  assert.match(languages.en, /^## Houseplan 1\.80\.1 release\n\nEditing your plan is easier:/);
  for (const body of Object.values(languages)) {
    assert.equal(body.split(/\n\n(?=🧱|🔋|📡|🗑️|💾)/).length, 6);
    assert.doesNotMatch(body, /\n[-*] |#834|#832|## Основное|## Highlights/);
  }
  // A format fixture, not a retrospective assertion about milestone membership.
  const catalogue = { cycle: { schema: 1, baseStable, targetStable: tag, milestone: { number: 1, title: '1.80.1' } },
    entries: [803,792,806,807,817,798,800,819,820].map((issue) => ({ issue, category: 'major' }))
      .concat({ issue: 814, category: 'stable-fix' }) };
  assert.equal(validateNarrative(compose(), { tag, catalogue }), compose());
});

test('section selection is tag-specific and rejects missing/duplicate tags, wrong locale and stale base', () => {
  assert.equal(userStableSection(`${ru}\n<!-- release: v1.79.0 -->\n<!-- base: v1.78.0 -->\n## Релиз Houseplan 1.79.0\n\nOld.`, { tag, language: 'ru' }).body,
    userStableSection(ru, { tag, language: 'ru' }).body);
  const fenced = '# Example\n```md\n<!-- release: v1.80.1 -->\n```\n';
  assert.throws(() => userStableSection(fenced, { tag, language: 'ru' }), /exactly one/);
  assert.throws(() => compose({ changelogRu: `${ru}\n${ru}` }), /exactly one/);
  assert.throws(() => compose({ changelogEn: en.replace(tag, 'v1.80.0') }), /exactly one/);
  assert.throws(() => compose({ changelogEn: en.replace('Houseplan 1.80.1 release', 'Релиз Houseplan 1.80.1') }), /exact release heading/);
  assert.throws(() => compose({ changelogRu: ru.replace('Релиз Houseplan 1.80.1', 'Новый релиз - HousePlan 1.80.1') }), /exact release heading/);
  assert.throws(() => compose({ changelogEn: en.replace('Houseplan 1.80.1 release', 'New release - HousePlan 1.80.1') }), /exact release heading/);
  assert.throws(() => compose({ changelogRu: ru.replace(baseStable, 'v1.78.0') }), /previous stable/);
  assert.throws(() => compose({ changelogRu: ru.replace('1.80.1\n\nРедактировать', '1.80.1\nРедактировать') }), /blank line/);
  assert.throws(() => userStableSection(ru, { tag: `${tag}-beta.1`, language: 'ru' }), /stable release tag/);
});

test('retrospective 1.78/1.79 have equivalent locale coverage and links only to the owner-provided milestones', () => {
  const cases = [
    { tag: 'v1.78.0', baseStable: 'v1.77.0', milestone: 6, majors: [649,663,618,648,616],
      eligible: [691,689,687,664,663,660,655,649,648,647,645,640,626,625,618,617,616,615,614,613,612,611,610,609,608,607] },
    { tag: 'v1.79.0', baseStable: 'v1.78.0', milestone: 5, majors: [780,661],
      eligible: [780,762,757,756,746,745,744,742,740,739,725,713,711,694,693,661] },
  ];
  // Read-only milestone snapshots taken 2026-10-09. No CI network or membership mutation.
  for (const entry of cases) {
    const source = compose({ tag: entry.tag, baseStable: entry.baseStable });
    const catalogue = { cycle: { schema: 1, baseStable: entry.baseStable, targetStable: entry.tag,
      milestone: { number: entry.milestone, title: entry.tag.slice(1) } },
      entries: entry.eligible.map((issue) => ({ issue, category: entry.majors.includes(issue) ? 'major' : 'stable-fix' })) };
    assert.equal(validateNarrative(source, { tag: entry.tag, catalogue }), source);
    for (const body of Object.values(narrativeLanguages(source))) {
      const issues = [...body.matchAll(/\[#(\d+)\]/g)].map((match) => Number(match[1]));
      assert.deepEqual(issues, entry.majors);
      assert.match(body, new RegExp(`milestone%3A%22${entry.tag.slice(1)}%22\\)`));
    }
  }
});

test('release-notes CLI verifies immutable published metadata without circular top-level-await deadlock', () => {
  const script = fileURLToPath(new URL('../scripts/release-notes.mjs', import.meta.url));
  const cycle = JSON.parse(readFileSync(new URL('../docs/release-ledger/cycle.json', import.meta.url), 'utf8'));
  const before = readFileSync(new URL('../docs/RELEASE-NOTES.md', import.meta.url), 'utf8');
  const result = spawnSync(process.execPath, [script, cycle.baseStable, '--verify'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, before.startsWith(`<!-- release: ${cycle.baseStable} -->`) ? 0 : 1, result.stderr);
  assert.doesNotMatch(result.stderr, /unsettled top-level await/);
  const refused = spawnSync(process.execPath, [script, cycle.baseStable, '--write'], { encoding: 'utf8', timeout: 15000 });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Historical stable/);
  assert.equal(readFileSync(new URL('../docs/RELEASE-NOTES.md', import.meta.url), 'utf8'), before);
});

test('Telegram keeps the approved heading, emoji, bold, spacing and compact links with no duplicate wrapper', () => {
  const source = userStableSection(ru, { tag, language: 'ru' }).body;
  const payload = telegramPayload({ userChangelog: ru, tag, chat: 'test-only' });
  const rendered = markdownToTelegram(source);
  assert.equal(payload.text, rendered.html);
  assert.match(payload.text, /^<b>Релиз Houseplan 1\.80\.1<\/b>\n\n/);
  assert.match(payload.text, /\n\n🗑️ <b>Удаляйте пространство одним действием\.<\/b>/);
  assert.equal((payload.text.match(/<b>/g) || []).length, 6);
  assert.equal((payload.text.match(/<a href=/g) || []).length, 10);
  assert.doesNotMatch(rendered.plain, /https?:\/\/|houseplan-card v| release|Новый релиз|\*\*|##/);
  assert.equal(payload.link_preview_options.is_disabled, true);
  assert.throws(() => telegramPayload({ userChangelog: '# missing', tag, chat: 'test' }), /exactly one/);
});

test('Telegram CLI reads only the RU user source; unrelated technical RELEASE-NOTES cannot leak into the message', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hp-user-telegram-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, USER_STABLE_PATHS.ru), ru);
  writeFileSync(join(root, 'docs/RELEASE-NOTES.md'), 'TECHNICAL CONTENT MUST NOT BE SENT');
  const script = fileURLToPath(new URL('../scripts/telegram-release.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'payload.json'], { cwd: root, encoding: 'utf8',
    env: { ...process.env, EVENT: 'workflow_call', CALLED: 'true', INPUT_TAG: tag, CHAT: 'test-only' } });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(readFileSync(join(root, 'payload.json'), 'utf8'));
  assert.equal(payload.text, telegramPayload({ userChangelog: ru, tag, chat: 'test-only' }).text);
  assert.doesNotMatch(payload.text, /TECHNICAL CONTENT/);
  writeFileSync(join(root, USER_STABLE_PATHS.ru), '# No selected release');
  const missing = spawnSync(process.execPath, [script, 'refused.json'], { cwd: root, encoding: 'utf8',
    env: { ...process.env, EVENT: 'workflow_call', CALLED: 'true', INPUT_TAG: tag, CHAT: 'test-only' } });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /exactly one/);
});
