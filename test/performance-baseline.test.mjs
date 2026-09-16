import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  isStableTag, previousStableTag, releaseTrailerTag, requestedComparison, resolveComparisonBase,
} from '../scripts/performance-baseline.mjs';

const HEAD = 'a'.repeat(40);
const PARENT = 'b'.repeat(40);
const STABLE_175 = 'c'.repeat(40);
const STABLE_174 = 'd'.repeat(40);

/**
 * Дерево фикстуры описывается данными, а не подменой бинарника: ровно тот
 * приём, ради которого решение вынесено из shell (#587).
 */
const fakeGit = ({
  head = HEAD, parent = PARENT, tags = [
    { tag: 'v1.75.0', sha: STABLE_175 }, { tag: 'v1.74.0', sha: STABLE_174 },
  ],
  present = [HEAD, PARENT, STABLE_175, STABLE_174], ancestors = [PARENT, STABLE_175, STABLE_174],
  withoutBundleFreshness = [],
} = {}) => ({
  revParse: (ref) => (ref === 'HEAD' ? head : ref === 'HEAD^' ? parent : ref),
  exists: (sha) => present.includes(sha),
  isAncestor: (sha) => ancestors.includes(sha),
  hasPath: (sha) => !withoutBundleFreshness.includes(sha),
  stableTags: () => tags,
});

test('трейлер релиза читается, пре-релиз отличается от стабильного', () => {
  assert.equal(releaseTrailerTag('x\n\nRelease: v1.76.0\n'), 'v1.76.0');
  assert.equal(releaseTrailerTag('x\n\nRelease: v1.76.0-beta.5\n'), 'v1.76.0-beta.5');
  assert.equal(releaseTrailerTag('нет трейлера'), null);
  assert.equal(releaseTrailerTag('Release: v1.76.0 и ещё текст'), null);
  assert.ok(isStableTag('v1.76.0'));
  assert.ok(isStableTag('1.76.0'));
  assert.ok(!isStableTag('v1.76.0-beta.5'));
  assert.ok(!isStableTag(''));
});

test('AC1: кандидат стабильного релиза судится о предыдущий стабильный тег', () => {
  const resolved = resolveComparisonBase({
    eventName: 'push',
    pushBefore: PARENT,
    headMessage: 'Release v1.76.0\n\nIssue: #582\nUser-Visible: yes\nRelease: v1.76.0\n',
    git: fakeGit(),
  });
  assert.equal(resolved.sha, STABLE_175);
  assert.match(resolved.source, /previous stable tag v1\.75\.0/);
  assert.match(resolved.source, /stable candidate v1\.76\.0/);
  assert.deepEqual(resolved.warnings, []);
});

test('AC2: второй коммит линейки не сравнивается сам с собой', () => {
  // Ровно ситуация выпуска v1.76.0: `main` уже несёт первый коммит линейки,
  // поэтому `push before` — он же. Если бы база бралась оттуда, гейт был бы
  // зелёным независимо от кода.
  const firstOfTheLine = PARENT;
  const resolved = resolveComparisonBase({
    eventName: 'push',
    pushBefore: firstOfTheLine,
    headMessage: 'perf: принять шаг изометрии (#585)\n\nIssue: #585\nUser-Visible: no\nRelease: v1.76.0\n',
    git: fakeGit(),
  });
  assert.notEqual(resolved.sha, firstOfTheLine, 'база не должна быть предыдущим коммитом той же линейки');
  assert.equal(resolved.sha, STABLE_175);
});

test('AC3: бета-кандидат и обычный push сохраняют прежнюю базу', () => {
  const beta = resolveComparisonBase({
    eventName: 'push',
    pushBefore: PARENT,
    headMessage: 'Prepare v1.76.0-beta.5\n\nRelease: v1.76.0-beta.5\n',
    git: fakeGit(),
  });
  assert.equal(beta.sha, PARENT);
  assert.equal(beta.source, 'push before');

  const ordinary = resolveComparisonBase({
    eventName: 'push', pushBefore: PARENT, headMessage: 'fix: что-то (#1)\n', git: fakeGit(),
  });
  assert.equal(ordinary.sha, PARENT);
  assert.equal(ordinary.source, 'push before');

  const dispatch = resolveComparisonBase({
    eventName: 'workflow_dispatch', headMessage: 'fix: что-то (#1)\n', git: fakeGit(),
  });
  assert.equal(dispatch.sha, PARENT);
  assert.equal(dispatch.source, 'candidate parent');
});

test('ручная база сильнее всего, в том числе стабильного кандидата', () => {
  const resolved = resolveComparisonBase({
    eventName: 'workflow_dispatch',
    manualBase: STABLE_174,
    headMessage: 'Release v1.76.0\n\nRelease: v1.76.0\n',
    git: fakeGit(),
  });
  assert.equal(resolved.sha, STABLE_174);
  assert.match(resolved.source, /manual comparison ref/);
});

test('свой тег и тег на голове предыдущим не считаются', () => {
  const onHead = [{ tag: 'v1.76.0', sha: HEAD }, { tag: 'v1.75.0', sha: STABLE_175 }];
  assert.equal(previousStableTag(onHead, { headSha: HEAD })?.tag, 'v1.75.0');
  assert.equal(previousStableTag(onHead, { headSha: 'z'.repeat(40), candidateTag: 'v1.76.0' })?.tag, 'v1.75.0');
  assert.equal(previousStableTag(onHead, { headSha: 'z'.repeat(40), candidateTag: '1.76.0' })?.tag, 'v1.75.0',
    'тег кандидата узнаётся и без ведущей v');
  assert.equal(previousStableTag([{ tag: 'v1.76.0-beta.5', sha: STABLE_175 }], {}), null,
    'бета стабильным тегом не является');
  assert.equal(previousStableTag([], {}), null);
});

test('стабильный кандидат без предыдущего тега честно откатывается к родителю', () => {
  const resolved = resolveComparisonBase({
    eventName: 'push',
    pushBefore: PARENT,
    headMessage: 'Release v1.0.0\n\nRelease: v1.0.0\n',
    git: fakeGit({ tags: [] }),
  });
  assert.equal(resolved.sha, PARENT);
  assert.match(resolved.source, /no previous stable tag/);
  assert.equal(resolved.warnings.length, 1);
  assert.match(resolved.warnings[0], /No stable tag before v1\.0\.0/);
});

test('непригодная база уводит в сторону большего сравнения, а не меньшего', () => {
  const rebased = resolveComparisonBase({
    eventName: 'push', pushBefore: 'e'.repeat(40), headMessage: 'fix: x\n',
    git: fakeGit({ present: [HEAD, PARENT, 'e'.repeat(40)], ancestors: [PARENT] }),
  });
  assert.equal(rebased.sha, PARENT, 'не предок — берём родителя');
  assert.match(rebased.warnings[0], /no longer an ancestor/);

  const missing = resolveComparisonBase({
    eventName: 'push', pushBefore: 'e'.repeat(40), headMessage: 'fix: x\n',
    git: fakeGit({ present: [HEAD, PARENT] }),
  });
  assert.equal(missing.sha, PARENT);
  assert.match(missing.warnings[0], /not present after fetching/);

  assert.throws(() => resolveComparisonBase({
    eventName: 'push', pushBefore: 'e'.repeat(40), headMessage: 'fix: x\n',
    git: fakeGit({ parent: null, present: [HEAD], tags: [] }),
  }), /No usable comparison commit/);
});

test('база старше HP-PERF-01 заменяется родителем', () => {
  const resolved = resolveComparisonBase({
    eventName: 'push',
    pushBefore: PARENT,
    headMessage: 'Release v1.76.0\n\nRelease: v1.76.0\n',
    git: fakeGit({ withoutBundleFreshness: [STABLE_175] }),
  });
  assert.equal(resolved.sha, PARENT);
  assert.match(resolved.source, /HP-PERF-01/);
});

test('workflow берёт базу из скрипта, а не из собственного shell (#587)', () => {
  const workflow = readFileSync(new URL('../.github/workflows/performance.yml', import.meta.url), 'utf8');
  assert.match(workflow, /scripts\/performance-baseline\.mjs/);
  assert.match(workflow, /HEAD_MESSAGE:/, 'сообщение head-коммита обязано доехать до скрипта');
  assert.ok(!/source="candidate parent"/.test(workflow),
    'прежняя shell-развилка должна быть убрана целиком, иначе решений снова два');
});
