import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as packet from '../scripts/task-packet.mjs';
import {
  branchIsInfrastructure, buildPacket, evidenceFor, productFlowEvidence, extractAcceptanceCriteria, lastVerdict, ownerDecisions, renderPacket, rightsFor,
  trackFromLabels, hasTrackLabel, readMergeState,
} from '../scripts/task-packet.mjs';
import { materialAnchorBlock } from '../scripts/review-doc-guard.mjs';

// #496: пакет задачи — производное представление; проверяется, что он выводится
// из меток/комментариев/документов детерминированно и ничего не додумывает.

const TREE = 'a'.repeat(40);

test('права выводятся из статусной метки по правилу №1 (#496)', () => {
  assert.ok(rightsFor('S6-in-progress').some((l) => l.includes('МОЖНО')));
  assert.ok(rightsFor('S3-spec').some((l) => l.includes('НЕЛЬЗЯ')));
  assert.ok(rightsFor('S7-code-review').some((l) => l.includes('#312')));
  assert.ok(rightsFor('S6-in-progress', ['blocked'])[0].startsWith('blocked'));
  assert.ok(rightsFor('S7-code-review', ['review-4'])[0].startsWith('review-4'));
  assert.ok(rightsFor(null).some((l) => l.includes('продуктовая задача вне процесса')));
  const infrastructure = rightsFor(null, ['infra'], { infrastructure: true });
  assert.ok(infrastructure.some((l) => l.includes('инфраструктурную реализацию МОЖНО')));
  assert.ok(infrastructure.some((l) => l.includes('S7-code-review')));
  assert.ok(infrastructure.every((l) => !l.includes('продуктовый код трогать МОЖНО')));
  assert.ok(rightsFor('S6-in-progress', ['infra']).some((l) => l.includes('продуктовый код трогать МОЖНО')),
    'the thematic infra label alone must not override an S6 product status');
  const hint = rightsFor(null, ['infra'], { infrastructureHint: true });
  assert.ok(hint.some((l) => l.includes('только подсказка, не доказательство и не право')));
  assert.ok(hint.some((l) => l.includes('предварительный инфраструктурный вход')));
});

test('AC распознаются из таблицы ТЗ и из строк тела issue (#496)', () => {
  const table = '| # | AC | Чем краснеет |\n|---|---|---|\n| AC1 | initial View ≤ 290 000 Б | budget |\n| **AC2** | план с мебелью | смок |\n';
  assert.deepEqual(extractAcceptanceCriteria(table).map((a) => a.id), ['AC1', 'AC2']);
  const body = 'Текст\n- AC1: кнопка ОК видна\n- AC2 — Enter подтверждает\nAC1: дубликат игнорируется\n';
  const acs = extractAcceptanceCriteria(body);
  assert.deepEqual(acs.map((a) => a.id), ['AC1', 'AC2']);
  assert.equal(acs[0].text, 'кнопка ОК видна');
});

test('свидетель AC берётся из последнего документа ревью; отсутствие — «без записи» (#496)', () => {
  const acs = [{ id: 'AC1', text: 'x' }, { id: 'AC12', text: 'y' }, { id: 'AC2', text: 'z' }];
  const doc = '## Разбор\nAC1 — доказан smoke_x, тест умеет падать\nAC12 проверен чтением\n';
  const out = evidenceFor(acs, doc);
  assert.match(out[0].evidence, /доказан smoke_x/);
  assert.match(out[1].evidence, /проверен чтением/);
  assert.equal(out[2].evidence, 'без записи в последнем документе ревью');
});

test('решения владельца — только его комментарии со словами решения (#496)', () => {
  const comments = [
    { author: 'Matysh', body: '## Решения владельца и материалы\nтекст', createdAt: '2026-09-08T13:35:00Z', url: 'u1' },
    { author: 'claude[bot]', body: 'Вердикт: зелёный · решение не моё', createdAt: '2026-09-08T14:00:00Z' },
    { author: 'Matysh', body: 'Взял: автор ТЗ', createdAt: '2026-09-08T13:49:00Z' },
  ];
  const out = ownerDecisions(comments, 'Matysh');
  assert.equal(out.length, 1);
  assert.equal(out[0].head, 'Решения владельца и материалы');
});

test('последний вердикт — из комментария и из записи конвейера в документе (#496)', () => {
  const comments = [
    { body: 'Вердикт: жёлтый · заход r1 · High: 0 · Medium: 4 → в задаче', createdAt: '1' },
    { body: 'Вердикт: зелёный · заход r3 · High: 0 · Medium: 0', createdAt: '2' },
  ];
  const docs = [
    { name: 'CODE-REVIEW-437-r1.md', text: materialAnchorBlock({ tree: 'b'.repeat(40), verdict: 'yellow', high: 0 }) },
    { name: 'CODE-REVIEW-437-r3.md', text: materialAnchorBlock({ tree: TREE, verdict: 'green', high: 0 }) },
    { name: 'SPEC-REVIEW-437-r2.md', text: materialAnchorBlock({ tree: 'c'.repeat(40), verdict: 'green', high: 0 }) },
  ];
  const v = lastVerdict(comments, docs, 'code');
  assert.match(v.comment.line, /зелёный · заход r3/);
  assert.equal(v.doc.name, 'CODE-REVIEW-437-r3.md');
  assert.equal(v.doc.tree, TREE);
  assert.deepEqual(v.doc.recorded, { verdict: 'green', high: 0 });
  assert.equal(lastVerdict(comments, docs, 'spec').doc.name, 'SPEC-REVIEW-437-r2.md');
});

test('пакет собирается и рендерится: статус, материал, совпадение дерева, непроверенное (#496)', () => {
  const doc = `# CODE-REVIEW-437-r3\nAC1 — доказан smoke_x\n\n${materialAnchorBlock({ sha: 'd'.repeat(40), tree: TREE, branch: 'issue/437-summary-panel', verdict: 'green', high: 0 })}`;
  const packet = buildPacket({
    issue: { number: 437, title: 'View: панель', state: 'OPEN', url: 'https://x/437', body: '- AC1: панель видна\n- AC2: панель скрывается\n' },
    labels: ['P2', 'feature', 'S6-in-progress', 'small'],
    comments: [{ author: 'Matysh', body: '## Решения владельца\n…', createdAt: '2026-09-08T13:35:00Z' },
      { author: 'claude[bot]', body: 'Вердикт: зелёный · заход r3 · High: 0 · Medium: 0', createdAt: '2026-09-08T17:37:00Z' }],
    branch: { name: 'issue/437-summary-panel', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 3, behind: 0, treeWithoutReviews: TREE, infrastructure: false },
    reviewDocs: [{ name: 'CODE-REVIEW-437-r3.md', text: doc }],
    validate: { status: 'зелёный', url: 'https://run' },
  });
  assert.equal(packet.status, 'S6-in-progress');
  assert.equal(packet.track, 'show');
  assert.equal(packet.material.treeMatchesVerdict, true);
  assert.deepEqual(packet.unverified, ['AC2']);
  const md = renderPacket(packet);
  assert.match(md, /# Пакет задачи #437/);
  assert.match(md, /применит его без модели \(#499\)/);
  assert.match(md, /\*\*AC2\*\* панель скрывается → без записи/);
  assert.match(md, /Validate на вершине: зелёный/);
  // Ничего не додумывается: без ветки — прямо сказано, что материал не запушен.
  assert.match(renderPacket(buildPacket({ issue: { number: 1, title: 't', state: 'OPEN', body: '' }, labels: [] })), /материал не запушен/);
});

test('#562: statusless infra issue is the accelerated track ending at S7 review', () => {
  const packet = buildPacket({
    issue: { number: 562, title: 'process', state: 'OPEN', url: 'u', body: '' },
    labels: ['P1', 'infra', 'process', 'tech-debt'],
    branch: { name: 'issue/562-process', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 1, behind: 0, treeWithoutReviews: null, infrastructure: true },
  });
  assert.equal(packet.status, null);
  assert.equal(packet.track, 'инфраструктурный · show', 'r1 #695: инфраструктура без трековой метки — show (§5.1)');
  const md = renderPacket(packet);
  assert.match(md, /инфраструктурный вход/);
  assert.match(md, /S7-code-review/);
});

test('#562: the infra label alone never grants the accelerated track', () => {
  const packet = buildPacket({
    issue: { number: 999, title: 'mislabeled product', state: 'OPEN', url: 'u', body: '' },
    labels: ['infra', 'S6-in-progress'],
    branch: { name: 'issue/999-product', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 1, behind: 0, treeWithoutReviews: null, infrastructure: false },
  });
  assert.equal(packet.track, 'ask');
  assert.ok(packet.rights.some((l) => l.includes('продуктовый код трогать МОЖНО')));
});

test('#562: before a branch exists the infra label prompts classification but grants no rights', () => {
  const packet = buildPacket({
    issue: { number: 1000, title: 'unpublished infra candidate', state: 'OPEN', url: 'u', body: '' },
    labels: ['infra'],
    branch: null,
  });
  assert.equal(packet.status, null);
  assert.match(packet.track, /предварительно/);
  assert.ok(packet.rights.some((l) => l.includes('без class A начинай сразу')));
  assert.ok(packet.rights.some((l) => l.includes('не доказательство и не право')));
  assert.ok(packet.rights.every((l) => !l.includes('продуктовый код трогать МОЖНО')));
});

test('#632: review documents never classify a branch as infrastructure', () => {
  assert.equal(branchIsInfrastructure(['docs/reviews/SPEC-REVIEW-607-r1.md']), false,
    'a product branch holding only its spec review is not an infrastructure diff');
  assert.equal(branchIsInfrastructure(['docs/reviews/SPEC-REVIEW-607-r1.md', 'scripts/task-packet.mjs']), true);
  assert.equal(branchIsInfrastructure(['scripts/task-packet.mjs', 'src/space-render.ts']), false);
  assert.equal(branchIsInfrastructure([]), false);
});

test('#632: product S6 issue keeps class A rights while its diff has no class A yet', () => {
  const packet = buildPacket({
    issue: { number: 607, title: 'HA dialog close', state: 'OPEN', url: 'u', body: '## ТЗ\n\n| AC1 | диалог закрывается | смок |\n' },
    labels: ['bug', 'P2', 'S6-in-progress', 'small'],
    // Даже если сборщик входов счёл дифф инфраструктурным (старый collectInputs
    // или дифф только из class B/C), продуктовый поток сильнее эвристики.
    branch: { name: 'issue/607-ha-dialog-close', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 1, behind: 0, treeWithoutReviews: null, infrastructure: true },
    reviewDocs: [{ name: 'SPEC-REVIEW-607-r1.md', text: 'Вердикт: зелёный' }],
  });
  assert.equal(packet.track, 'show');
  assert.ok(packet.rights.some((l) => l.includes('продуктовый код трогать МОЖНО')));
  assert.ok(packet.rights.every((l) => !l.includes('файлы класса A трогать НЕЛЬЗЯ')));
  assert.match(renderPacket(packet), /Продуктовый поток: .*ТЗ/);

  // Каждый признак потока по отдельности достаточен.
  const bare = { issue: { number: 1, body: '' } };
  assert.deepEqual(productFlowEvidence({ ...bare, status: 'S5-ready' }), ['статус S5-ready']);
  assert.deepEqual(productFlowEvidence({ status: 'S6-in-progress', issue: { body: 'x\n## ТЗ\n- AC1: y' } }), ['раздел «## ТЗ» в теле issue']);
  assert.deepEqual(productFlowEvidence({ status: 'S6-in-progress', issue: { body: '## ТЗшка не раздел' } }), []);
  assert.equal(productFlowEvidence({ ...bare, status: 'S6-in-progress', specs: [{ name: '1-x.md' }] }).length, 1);
  assert.equal(productFlowEvidence({ ...bare, status: 'S7-code-review', reviewDocs: [{ name: 'SPEC-REVIEW-1-r2.md' }] }).length, 1);
  assert.equal(productFlowEvidence({ ...bare, comments: [{ body: 'SPEC-REVIEW-1-r1\nВердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0' }] }).length, 1);
});

test('#632: statusless or returned infra issue without spec keeps the class A ban', () => {
  for (const labels of [['bug', 'infra', 'process'], ['infra', 'S6-in-progress'], ['infra', 'S7-code-review']]) {
    const packet = buildPacket({
      issue: { number: 632, title: 'task packet', state: 'OPEN', url: 'u', body: 'Симптом и ожидаемое поведение, без ТЗ.' },
      labels,
      branch: { name: 'issue/632-task-packet-track', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 1, behind: 0, treeWithoutReviews: null, infrastructure: true },
      reviewDocs: [{ name: 'CODE-REVIEW-632-r1.md', text: 'Вердикт: жёлтый' }],
    });
    assert.deepEqual(packet.productFlow, [], labels.join(','));
    assert.equal(packet.track, 'инфраструктурный · show', labels.join(','));
    assert.ok(packet.rights.some((l) => l.includes('файлы класса A трогать НЕЛЬЗЯ')), labels.join(','));
    assert.ok(packet.rights.every((l) => !l.includes('продуктовый код трогать МОЖНО')), labels.join(','));
  }
});

test('#632 r1: trivial issue in S6/S7 keeps class A rights without any spec artefact', () => {
  // Форма реального trivial-бага #612: дефекты и AC в теле, без «## ТЗ», без
  // docs/specs и без ревью ТЗ — короткий трек их не пишет (PROCESS §5.1).
  const body = '## Дефект 1\nx\n\n## Дефект 2\ny\n\n## AC\n- AC1. a\n- AC2. b\n- AC3. c\n';
  for (const labels of [['bug', 'P2', 'trivial', 'S6-in-progress'], ['bug', 'P2', 'trivial', 'infra', 'S7-code-review']]) {
    const packet = buildPacket({
      issue: { number: 612, title: 'trivial bug', state: 'OPEN', url: 'u', body },
      labels,
      branch: { name: 'issue/612-x', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 1, behind: 0, treeWithoutReviews: null, infrastructure: true },
    });
    assert.equal(packet.track, 'show', labels.join(','));
    assert.ok(packet.rights.some((l) => l.includes('продуктовый код трогать МОЖНО')), labels.join(','));
    assert.ok(packet.rights.every((l) => !l.includes('файлы класса A трогать НЕЛЬЗЯ')), labels.join(','));
  }
  assert.deepEqual(productFlowEvidence({ status: 'S6-in-progress', labels: ['trivial'], issue: { body } }),
    ['прежняя метка trivial — продуктовый поток, читается как track:show (§5.1)']);
  assert.deepEqual(productFlowEvidence({ status: 'S6-in-progress', labels: ['small', 'infra'], issue: { body } }), [],
    'только trivial: small несёт ТЗ в теле и доказывается разделом «## ТЗ»');
});

test('#517 AC5: AC берутся из тела issue, файл ТЗ — только когда в теле их нет', () => {
  const base = {
    issue: { number: 700, title: 'x', state: 'OPEN', url: 'u', body: '## ТЗ\n\n- AC1. Из тела\n' },
    labels: ['S6-in-progress'], comments: [],
    specs: [{ name: '700-old.md', text: '| AC1 | Из файла |\n| AC2 | Тоже из файла |' }],
  };
  const fromBody = buildPacket(base);
  assert.deepEqual(fromBody.acceptance.map((a) => a.text), ['Из тела'], 'тело важнее файла');

  const legacy = buildPacket({ ...base, issue: { ...base.issue, body: 'просто описание, AC нет' } });
  assert.deepEqual(legacy.acceptance.map((a) => a.id), ['AC1', 'AC2'], 'без AC в теле — архивный файл');

  const neither = buildPacket({ ...base, issue: { ...base.issue, body: 'ничего' }, specs: [] });
  assert.deepEqual(neither.acceptance, []);
});

test('#695: трек по меткам — track:* главнее прежних, по умолчанию ask', () => {
  assert.equal(trackFromLabels(['track:ship']), 'ship');
  assert.equal(trackFromLabels(['track:show', 'bug']), 'show');
  assert.equal(trackFromLabels(['track:ask', 'small']), 'ask', 'явная метка владельца главнее прежней');
  assert.equal(trackFromLabels(['trivial']), 'show');
  assert.equal(trackFromLabels(['small']), 'show');
  assert.equal(trackFromLabels(['bug', 'P2']), 'ask');
  assert.equal(trackFromLabels([]), 'ask');
});

test('r1 #695: инфраструктурная задача с явной меткой трека несёт её, без метки — show', () => {
  const at = (labels) => buildPacket({
    issue: { number: 7, title: 'infra', state: 'OPEN', url: 'u', body: '' },
    labels,
    branch: { name: 'issue/7-x', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 1, behind: 0, treeWithoutReviews: null, infrastructure: true },
  }).track;
  assert.equal(at(['infra']), 'инфраструктурный · show');
  assert.equal(at(['infra', 'track:ask']), 'инфраструктурный · ask', 'метка владельца главнее');
  assert.equal(at(['infra', 'track:ship']), 'инфраструктурный · ship');
  assert.equal(hasTrackLabel(['bug', 'infra']), false);
  assert.equal(hasTrackLabel(['small']), true);
});

// ---------- #707: трек, следующий шаг, риск, проверки, changelog ----------

const DIFF = (path, text, line = 3) => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -${line - 1},0 +${line} @@\n+${text}\n`;
const branchWith = (over = {}) => ({
  name: 'issue/707-x', tip: 'e'.repeat(40), base: 'f'.repeat(40), ahead: 1, behind: 0, treeWithoutReviews: null, infrastructure: false,
  changedFiles: [], diff: '', commits: [], smokes: null, mergeClean: true, conflicts: [], ...over,
});
const packetOf = ({ labels = ['S6-in-progress'], comments = [], branch = branchWith(), body = '## ТЗ\n- AC1: x\n' } = {}) => buildPacket({
  issue: { number: 707, title: 'risk', state: 'OPEN', url: 'u', body }, labels, comments, owner: 'Matysh', branch,
});

test('#707 AC6: пакет берёт трек, основание, лимит, риск и ребейз из тех же функций, что конвейер', async () => {
  const track = await import('../scripts/process-track.mjs');
  for (const name of ['trackOrigin', 'cycleLimit', 'rebaseBeforeReview', 'classifyRisk', 'trackFromLabels', 'hasTrackLabel']) {
    assert.equal(packet[name], track[name], name);
  }
});

test('#707 AC7: пакет — раздел «Трек»: четыре основания, лимит и ребейз в markdown и --json', () => {
  const owner = [{ author: 'Matysh', body: 'Трек: show — решение владельца', createdAt: '2026-09-30T08:00:00Z' }];
  const variants = [
    [{ labels: ['S6-in-progress', 'track:show'], comments: owner }, 'show', 'метка, подтверждённая владельцем (2026-09-30)', 2, false],
    [{ labels: ['S6-in-progress', 'track:ship'] }, 'ship', 'метка без подтверждения — предложение', 2, false],
    [{ labels: ['S6-in-progress', 'small'] }, 'show', 'прежняя метка small → show (§5.1)', 2, false],
    [{ labels: ['S6-in-progress'] }, 'ask', 'метки нет: продукт → ask', 4, true],
  ];
  for (const [input, track, basis, limit, rebase] of variants) {
    const p = packetOf(input);
    assert.deepEqual(
      { track: p.trackDetail.track, basis: p.trackDetail.basis, limit: p.trackDetail.limit, rebase: p.trackDetail.rebaseBeforeReview },
      { track, basis, limit, rebase }, basis,
    );
    const md = renderPacket(p);
    assert.match(md, new RegExp(`## Трек\\n- ${track} · основание: ${basis.replace(/[()]/g, '\\$&')}\\n- лимит циклов код-ревью: ${limit} · ребейз до ревью: ${rebase ? 'да' : 'нет'}\\n`));
    assert.equal(JSON.parse(JSON.stringify(p)).trackDetail.basis, basis, '--json несёт те же поля');
  }
  const infra = packetOf({ labels: ['infra'], branch: branchWith({ infrastructure: true }), body: '' });
  assert.equal(infra.trackDetail.basis, 'метки нет: инфраструктура → show');
  const two = renderPacket(packetOf({ labels: ['S6-in-progress', 'track:ship', 'track:ask'] }));
  assert.match(two, /- внимание: несколько трековых меток \(track:ask, track:ship\) — дефект разметки, действует строжайшая track:ask/);
  // Без ветки политика show/ship зависит от чистоты слияния — пакет её не выдумывает.
  assert.equal(packetOf({ labels: ['track:show'], branch: null }).trackDetail.rebaseBeforeReview, null);
  assert.match(renderPacket(packetOf({ labels: ['track:show'], branch: null })), /ребейз до ревью: только при конфликте с dev/);
});

test('#707 AC8: следующий шаг — ребейз только там, где он нужен', () => {
  const at = (labels, over) => renderPacket(packetOf({ labels: ['S6-in-progress', ...labels], branch: branchWith(over) }));
  assert.doesNotMatch(at(['track:show'], { behind: 0 }), /## Следующий шаг/, 'позади 0 — про ребейз ничего');
  const askClean = at(['track:ask'], { behind: 3, mergeClean: true });
  assert.match(askClean, /## Следующий шаг\n- позади dev на 3, слияние чистое — конвейер сам приведёт ветку к dev до ревью/);
  const showClean = at(['track:show'], { behind: 3, mergeClean: true });
  assert.match(showClean, /- позади dev на 3, слияние чистое — ребейз не нужен: один раз при слиянии/);
  for (const md of [askClean, showClean]) assert.doesNotMatch(md, /перед S7 ребейз/);
  assert.match(at(['track:show'], { behind: 2, mergeClean: false, conflicts: ['src/a.ts', 'docs/b.md'] }),
    /- слияние с dev конфликтует: src\/a\.ts, docs\/b\.md — ребейз до S7 \(`node scripts\/rebase-on-dev\.mjs`\)/);
  assert.match(at(['track:show'], { behind: 2, mergeClean: null }), /- позади dev на 2: чистота слияния не проверена/);
});

test('#707 AC8: чистота слияния — настоящий merge-tree во временном репозитории и отказ merge-tree', (t) => {
  if (spawnSync('git', ['--version']).status !== 0) { t.skip('git недоступен'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'hp-packet-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k))), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'dev');
  writeFileSync(join(dir, 'a.txt'), 'base\n'); writeFileSync(join(dir, 'b.txt'), 'base\n');
  git('add', '.'); git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'task');
  writeFileSync(join(dir, 'a.txt'), 'task\n');
  git('commit', '-q', '-am', 'task');
  git('checkout', '-q', 'dev');
  writeFileSync(join(dir, 'b.txt'), 'dev\n');
  git('commit', '-q', '-am', 'dev moves');
  assert.deepEqual(readMergeState({ cwd: dir, onto: 'dev', ref: 'task' }), { clean: true, conflicts: [] });
  writeFileSync(join(dir, 'a.txt'), 'dev\n');
  git('commit', '-q', '-am', 'dev conflicts');
  const conflict = readMergeState({ cwd: dir, onto: 'dev', ref: 'task' });
  assert.deepEqual(conflict, { clean: false, conflicts: ['a.txt'] });
  assert.match(renderPacket(packetOf({ labels: ['S6-in-progress', 'track:show'], branch: branchWith({ behind: 2, mergeClean: conflict.clean, conflicts: conflict.conflicts }) })),
    /слияние с dev конфликтует: a\.txt — ребейз до S7/);
  // git < 2.38: `--write-tree` неизвестен — usage и код 129; это не «конфликта нет».
  const old = () => ({ status: 129, stdout: '', stderr: 'usage: git merge-tree <base-tree> <branch1> <branch2>' });
  assert.deepEqual(readMergeState({ cwd: dir, onto: 'dev', ref: 'task', run: old }), { clean: null, conflicts: [] });
  assert.deepEqual(readMergeState({ cwd: dir, run: () => ({ error: new Error('ENOENT') }) }), { clean: null, conflicts: [] });
});

const TOUCH = DIFF('src/pointer-modality.ts', "  if (e.pointerType === 'touch') return;", 7);
const RENDER = DIFF('src/render/paper-scene.ts', '  const scale = 2;');
const GEOMETRY = DIFF('src/wall-merge.ts', '  const merged = a + b;');
const STYLE = DIFF('src/styles/plan.styles.ts', '    gap: 4px;');

test('#707 AC9: риск по участкам и следствие по треку', () => {
  const risk = (labels, comments = []) => packetOf({ labels: ['S6-in-progress', ...labels], comments, branch: branchWith({ diff: TOUCH }) });
  const confirmed = [{ author: 'Matysh', body: 'Трек: ship — решение владельца', createdAt: '2026-09-30T08:00:00Z' }];
  assert.equal(risk(['track:ship']).risk.consequence, 'конвейер повысит до show при S7');
  assert.equal(risk(['track:ship'], confirmed).risk.consequence, 'не повысит; риск прочтёт пакетное ревью');
  assert.equal(risk(['track:show']).risk.consequence, 'ревьюер спросит, где поведение зафиксировано; нет ссылки — повысить до ask до S7 (§5)');
  assert.equal(risk(['track:ask']).risk.consequence, 'справочно');
  const md = renderPacket(risk(['track:ship']));
  assert.match(md, /## Риск по участкам\n- touch: src\/pointer-modality\.ts:7 · участок pointer-modality, токен pointerType\n- следствие: конвейер повысит до show при S7\n/);
  assert.match(renderPacket(packetOf({ branch: null })), /## Риск по участкам\n- не посчитан: ветки нет\n/);
  assert.doesNotMatch(renderPacket(packetOf({ branch: branchWith({ diff: DIFF('scripts/x.mjs', 'pointerdown') }) })), /## Риск по участкам/,
    'пустой раздел не печатается');
  assert.equal(JSON.parse(JSON.stringify(risk(['track:ship']))).risk.classes[0], 'touch', '--json несёт риск');
});

test('#707 AC10: обязательные проверки с основаниями', () => {
  const checksOf = (over, labels = []) => packetOf({ labels: ['S6-in-progress', ...labels], branch: branchWith(over) }).checks;
  const commands = (list) => list.map((c) => c.command);
  const base = checksOf({});
  assert.deepEqual(base, [{ command: '`npm run gate:small`', reason: 'всегда (§8)' }], 'gate:small — всегда');
  assert.deepEqual(packetOf({ branch: null }).checks.map((c) => c.command), ['`npm run gate:small`']);
  const smokes = checksOf({ smokes: { direct: [{ smoke: 'smoke_a.mjs', symbols: ['_wallA'] }], registered: [{ smoke: 'smoke_b.mjs', symbols: ['_b'] }], visualMinimum: ['smoke_modes.mjs'] } });
  assert.deepEqual(smokes.slice(1).map((c) => `${c.command} · ${c.reason}`), [
    '`node demo/smoke_a.mjs` · smoke-select: прямое совпадение (_wallA)',
    '`node demo/smoke_b.mjs` · smoke-select: зарегистрированная связь (_b)',
    '`npm run gate:small -- --smokes` · smoke-select: визуальный минимум — связь диффа со смоками не доказана (#690): smoke_modes',
  ]);
  assert.ok(commands(checksOf({ diff: GEOMETRY })).includes('`npm run invariants -- --config <экспорт>`'), 'invariants при geometry');
  assert.ok(!commands(checksOf({ diff: TOUCH })).some((c) => c.includes('invariants')), 'без geometry — нет');
  assert.ok(commands(checksOf({ changedFiles: ['custom_components/houseplan/store.py'] })).includes('`python -m pytest tests_backend -q`'));
  assert.ok(!commands(checksOf({ changedFiles: ['src/a.ts', 'tests_backend/test_x.py'] })).some((c) => c.includes('pytest')), 'pytest — только при custom_components/**/*.py');
  for (const mirror of ['src/junction-limits.ts', 'custom_components/houseplan/junction_limits.py', 'test/fixtures/junction-limits-parity.json']) {
    assert.ok(commands(checksOf({ changedFiles: [mirror] })).some((c) => c.includes('junction_parity.py')), mirror);
  }
  assert.ok(!commands(checksOf({ changedFiles: ['src/wall-merge.ts'] })).some((c) => c.includes('junction_parity')));
  const golden = (over, labels) => checksOf(over, labels).find((c) => c.command.includes('ci:golden'));
  assert.match(golden({ diff: RENDER }).reason, /^рекомендовано, если сдвиг кадров намерен/, 'ci:golden — при visual/render');
  assert.match(golden({ diff: RENDER }, ['ci:golden']).reason, /^стоит/);
  assert.equal(golden({ diff: STYLE }), undefined, 'visual/ui — без ci:golden');
  assert.equal(golden({ diff: DIFF('src/render/paper-scene.ts', '  // stroke-width: 2') }), undefined, 'только комментарии — без ci:golden');
  assert.equal(golden({ diff: DIFF('test/render.test.mjs', "  stroke-width='2'"), changedFiles: ['test/render.test.mjs'] }), undefined, 'только тесты — без ci:golden');
  assert.match(renderPacket(packetOf({ branch: branchWith({ diff: GEOMETRY }) })), /## Обязательные проверки\n- `npm run gate:small` · всегда \(§8\)\n- `npm run invariants -- --config <экспорт>` · риск geometry/);
});

test('#707 AC11: changelog и визуальное свидетельство', () => {
  const commits = [
    { message: 'fix: a (#707)\n\nIssue: #707\nUser-Visible: yes\n' },
    { message: 'test: b (#707)\n\nIssue: #707\nUser-Visible: no\n' },
    { message: 'docs: c' },
  ];
  const p = packetOf({ branch: branchWith({ commits, changedFiles: ['src/a.ts', 'docs/CHANGELOG.md'] }) });
  assert.deepEqual(p.changelog, { yes: 1, no: 1, missing: ['docs/CHANGELOG.ru.md'], visualEvidence: false });
  const md = renderPacket(p);
  assert.match(md, /## Changelog и визуальное свидетельство\n- коммитов ветки: `User-Visible: yes` — 1, `User-Visible: no` — 1\n- не хватает docs\/CHANGELOG\.ru\.md/);
  assert.deepEqual(packetOf({ branch: branchWith({ commits, changedFiles: ['docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md'] }) }).changelog.missing, []);
  assert.deepEqual(packetOf({ branch: branchWith({ commits: [commits[1]] }) }).changelog.missing, [], 'User-Visible: no changelog не требует');
  const visual = renderPacket(packetOf({ branch: branchWith({ diff: RENDER }) }));
  assert.match(visual, /дефект растра или резкости требует свидетеля, красного на старом коде, и подтверждения владельца в GPU-браузере \(§7\.1\)/);
  assert.doesNotMatch(renderPacket(packetOf({ branch: branchWith({ diff: STYLE }) })), /## Changelog/, 'нет коммитов и нет визуала — раздел не печатается');
});
