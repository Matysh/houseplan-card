import test from 'node:test';
import assert from 'node:assert/strict';
import {
  branchIsInfrastructure, buildPacket, evidenceFor, productFlowEvidence, extractAcceptanceCriteria, lastVerdict, ownerDecisions, renderPacket, rightsFor,
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
  assert.equal(packet.track, 'small');
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
  assert.equal(packet.track, 'инфраструктурный');
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
  assert.equal(packet.track, 'полный');
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
  assert.equal(packet.track, 'small');
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
    assert.equal(packet.track, 'инфраструктурный', labels.join(','));
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
    assert.equal(packet.track, 'trivial', labels.join(','));
    assert.ok(packet.rights.some((l) => l.includes('продуктовый код трогать МОЖНО')), labels.join(','));
    assert.ok(packet.rights.every((l) => !l.includes('файлы класса A трогать НЕЛЬЗЯ')), labels.join(','));
  }
  assert.deepEqual(productFlowEvidence({ status: 'S6-in-progress', labels: ['trivial'], issue: { body } }),
    ['короткий трек trivial (ТЗ не пишется, §5.1)']);
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
