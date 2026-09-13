import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPacket, evidenceFor, extractAcceptanceCriteria, lastVerdict, ownerDecisions, renderPacket, rightsFor,
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
