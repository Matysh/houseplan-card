import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateItems, compareVersions, isStable, issuesOf, parseChangelog,
  previousStableTag, sectionsInRange, verifyReleaseNotes, visibleIssuesInRange,
} from '../scripts/release-notes.mjs';

// #328: правила тела стабильного релиза, решение владельца 2026-08-27.

test('versions compare with prereleases below their release', () => {
  assert.ok(compareVersions('v1.68.0-beta.4', 'v1.68.0') < 0);
  assert.ok(compareVersions('v1.68.1', 'v1.68.0') > 0);
  assert.ok(compareVersions('v1.68.0-beta.2', 'v1.68.0-beta.10') < 0);
  assert.equal(isStable('v1.68.0'), true);
  assert.equal(isStable('v1.68.0-rc.1'), false);
  assert.equal(previousStableTag('v1.69.0',
    ['v1.68.0', 'v1.68.1', 'v1.69.0-beta.1', 'v1.67.0']), 'v1.68.1');
  assert.equal(previousStableTag('v1.0.0', ['v1.0.0-beta.1']), null);
});

const CHANGELOG = `# Changelog

## Unreleased

- New drawing tool ([#400](https://github.com/x/y/issues/400)).

## v1.69.0-beta.2 — 2026-09-01

- Reworded drawing tool ([#400](https://github.com/x/y/issues/400)).
- Fix a beta-only crash ([#401](https://github.com/x/y/issues/401)).

## v1.69.0-beta.1 — 2026-08-30

- New drawing tool, first wording ([#400](https://github.com/x/y/issues/400)).

## v1.68.1 — 2026-08-27

- Stable hotfix ([#390](https://github.com/x/y/issues/390)).
`;

test('the stable range takes every section after the previous stable and dedupes by issue', () => {
  const sections = sectionsInRange(parseChangelog(CHANGELOG), 'v1.68.1', 'v1.69.0');
  assert.deepEqual(sections.map((section) => section.title.split(' ')[0]),
    ['Unreleased', 'v1.69.0-beta.2', 'v1.69.0-beta.1']);
  const items = aggregateItems(sections);
  // #400 появляется трижды — выигрывает самая новая формулировка (Unreleased),
  // #401 входит один раз; хотфикс #390 предыдущего стабильного не входит.
  assert.deepEqual(items.map(({ item }) => issuesOf(item)[0]), [400, 401]);
  assert.match(items[0].item, /New drawing tool/);
});

const gitStub = (visibleIssues) => (args) => {
  assert.equal(args[0], 'log');
  return visibleIssues.map((issue) =>
    `feat: something\n\nIssue: #${issue}\nUser-Visible: yes\n\x1e`).join('')
    + 'chore: infra\n\nIssue: #999\nUser-Visible: no\n\x1e';
};

test('visible issues come only from User-Visible commits', () => {
  const issues = visibleIssuesInRange('a..b', gitStub([400, 401]));
  assert.deepEqual([...issues].sort(), [400, 401]);
});

const notesFor = (body) => `<!-- release: v1.69.0 -->\n\n## Основное\n\n${body}\n`;

test('an empty filler line is an error; a justified one passes (#328 rule 3)', () => {
  const base = {
    tag: 'v1.69.0',
    changelogRu: CHANGELOG, changelogEn: CHANGELOG,
    tags: ['v1.68.0', 'v1.68.1'],
  };
  // Хотфикс одной задачи: всё упомянуто, приписка запрещена.
  const empty = verifyReleaseNotes({
    ...base,
    notes: notesFor('- Одна задача ([#400](https://github.com/x/y/issues/400)).\n- Мелкие исправления и улучшения.\n- Small fixes and improvements.'),
    gitRunner: gitStub([400]),
  });
  assert.equal(empty.errors.length, 1, JSON.stringify(empty.errors));
  assert.match(empty.errors[0], /приписка.*пустая/);

  // Есть непопавшая в тело user-visible работа — приписка законна.
  const justified = verifyReleaseNotes({
    ...base,
    notes: notesFor('- Одна задача ([#400](https://github.com/x/y/issues/400)).\n- Мелкие исправления и улучшения.\n\n## Highlights\n\n- One item ([#400](https://github.com/x/y/issues/400)).\n- Small fixes and improvements.'),
    gitRunner: gitStub([400, 401]),
  });
  assert.deepEqual(justified.errors, []);

  // Пункты без ссылок при наличии приписки — непроверяемо, ошибка.
  const unlinkable = verifyReleaseNotes({
    ...base,
    notes: notesFor('- Просто текст без ссылок.\n- Мелкие исправления и улучшения.\n- Small fixes and improvements.'),
    gitRunner: gitStub([400]),
  });
  assert.equal(unlinkable.errors.length, 1, JSON.stringify(unlinkable.errors));
  assert.match(unlinkable.errors[0], /не ссылаются на issues/);

  // Issue вне диапазона и ченджлога — тело шире релиза.
  const foreign = verifyReleaseNotes({
    ...base,
    notes: notesFor('- Чужая задача ([#777](https://github.com/x/y/issues/777)).'),
    gitRunner: gitStub([400]),
  });
  assert.equal(foreign.errors.length, 1, JSON.stringify(foreign.errors));
  assert.match(foreign.errors[0], /#777/);

  // Скрытая работа без приписки — предупреждение, не ошибка.
  const missing = verifyReleaseNotes({
    ...base,
    notes: notesFor('- Одна задача ([#400](https://github.com/x/y/issues/400)).'),
    gitRunner: gitStub([400, 401]),
  });
  assert.deepEqual(missing.errors, []);
  assert.equal(missing.warnings.length, 1);
});
